"""
core/tx_analysis.py — Transaction history behavioral analysis.

Takes raw transfer lists (from Alchemy + Etherscan) and detects
user-harm patterns from on-chain behavior, not just contract code.

Patterns detected:
  - Honeypot: many buys, near-zero sells
  - Drain: many senders, depleted balance (funds leaving fast)
  - Dump: deployer sells large position shortly after launch
  - Concentration: one address holds/moves most volume
  - Rapid deployment + activity (fresh contract, already busy)
  - Failed transfer clustering (reverts on sell attempts)
  - Wash trading / circular transfers
"""

from collections import Counter, defaultdict
from datetime import datetime, timezone

# Selector → function name map (subset of rules.py for tx decoding)
SELECTOR_MAP = {
    "a9059cbb": "transfer()",
    "23b872dd": "transferFrom()",
    "095ea7b3": "approve()",
    "40c10f19": "mint()",
    "42966c68": "burn()",
    "8456cb59": "pause()",
    "3f4ba83a": "unpause()",
    "44337ea1": "blacklist()",
    "f2fde38b": "transferOwnership()",
    "715018a6": "renounceOwnership()",
    "3659cfe6": "upgradeTo()",
    "4f1ef286": "upgradeToAndCall()",
    "947bc65f": "recoverFunds()",
    "9e281a98": "rescueTokens()",
    "db006a75": "rescue()",
    "5e8ab3b5": "adminWithdraw()",
    "c9567bf9": "openTrading()",
    "0498c0c1": "setMaxTxAmount()",
    "7afa1eed": "setCooldown()",
    "8f9a55a0": "setBlacklist()",
    "35ba5098": "blockAddress()",
    "dd62ed3e": "allowance()",
    "18160ddd": "totalSupply()",
    "70a08231": "balanceOf()",
    "a457c2d7": "decreaseAllowance()",
    "39509351": "increaseAllowance()",
}

DANGEROUS_CALLS = {
    "recoverFunds()", "rescueTokens()", "rescue()", "adminWithdraw()",
    "mint()", "pause()", "blacklist()", "setBlacklist()", "blockAddress()",
    "upgradeTo()", "upgradeToAndCall()", "openTrading()", "setCooldown()",
    "setMaxTxAmount()", "transferOwnership()",
}


def _decode_function(tx: dict) -> str | None:
    """Decode function name from tx input data using selector map."""
    inp = tx.get("input", "") or tx.get("data", "")
    if not inp or inp == "0x" or len(inp) < 10:
        return None
    selector = inp[2:10].lower()
    return SELECTOR_MAP.get(selector)


# ── helpers ──────────────────────────────────────────────────────────────────

def _addr(tx: dict, key: str) -> str:
    return (tx.get(key) or "").lower().strip()


def _value(tx: dict) -> float:
    """Best-effort USD/token value from Alchemy transfer object."""
    v = tx.get("value")
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _ts(tx: dict) -> datetime | None:
    """Parse metadata.blockTimestamp if present."""
    meta = tx.get("metadata") or {}
    ts_str = meta.get("blockTimestamp") or tx.get("blockTimestamp")
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return None


# ── main entry ────────────────────────────────────────────────────────────────

def analyze_transactions(
    address: str,
    inbound: list[dict],
    outbound: list[dict],
    normal_txs: list[dict],
    balance_eth: float,
    creation_time=None,
) -> dict:
    """
    Analyze inbound and outbound transfer lists for behavioral red flags.

    Args:
        address:     the contract being analyzed (checksummed)
        inbound:     transfers TO the contract (Alchemy asset transfers toAddress=address)
        outbound:    transfers FROM the contract (Alchemy asset transfers fromAddress=address)
        normal_txs:  regular ETH transactions from Etherscan (for revert/fail detection)
        balance_eth: current ETH balance from RPC

    Returns a dict:
        findings:       list of {label, severity, detail}
        summary:        human-readable multi-line string for LLM prompt
        behavioral_score: int (additive risk, wired into scoring engine)
    """
    addr = address.lower()
    findings = []
    behavioral_score = 0

    all_transfers = inbound + outbound
    total_in = len(inbound)
    total_out = len(outbound)
    real_inbound = [t for t in inbound if _value(t) > 0]
    real_outbound = [t for t in outbound if _value(t) > 0]
    real_total_in = len(real_inbound)
    real_total_out = len(real_outbound)

    # ── 1. Honeypot detection: buys succeed, sells absent or tiny ────────────
    # Only real-value transfers should count here. Zero-value mint / airdrop traffic
    # must not be mistaken for a user-funded honeypot flow.
    if real_total_in >= 5 and real_total_out == 0:
        findings.append({
            "label": "Honeypot signal: tokens flowing IN with zero outbound transfers",
            "severity": "high",
            "detail": f"{real_total_in} real inbound ({total_in} total inbound), 0 real outbound ({total_out} total outbound) — users cannot move funds out",
        })
        behavioral_score += 35

    elif real_total_in > 0 and real_total_out > 0:
        ratio = real_total_in / real_total_out
        if ratio > 10:
            findings.append({
                "label": f"Asymmetric flow: {real_total_in} real in vs {real_total_out} real out (ratio {ratio:.1f}x)",
                "severity": "medium",
                "detail": f"Strong real-value buy-side activity with minimal real-value sells ({total_in} inbound total, {total_out} outbound total) — possible honeypot or sell restriction",
            })
            behavioral_score += 20

    # ── 2. Drain pattern: many senders, balance near zero ────────────────────
    unique_senders = len({_addr(t, "from") for t in real_inbound if _addr(t, "from")})
    if unique_senders >= 5 and balance_eth < 0.001 and real_total_in > 0:
        findings.append({
            "label": f"Drain pattern: {unique_senders} unique senders with real value, balance ≈ 0 ETH",
            "severity": "high",
            "detail": f"Many addresses sent real funds ({real_total_in} non-zero inbound transfers out of {total_in} total inbound), but balance is depleted — funds likely extracted by admin",
        })
        behavioral_score += 30

    # ── 3. Volume concentration: one address dominates outbound ──────────────
    if real_outbound:
        out_by_addr = Counter(_addr(t, "to") for t in real_outbound if _addr(t, "to") and _addr(t, "to") != addr)
        if out_by_addr:
            top_addr, top_count = out_by_addr.most_common(1)[0]
            concentration = top_count / real_total_out if real_total_out else 0
            if concentration > 0.7 and real_total_out >= 3:
                findings.append({
                    "label": f"Outbound concentration: {concentration:.0%} of real outbound transfers to single address",
                    "severity": "high",
                    "detail": f"Address {top_addr[:10]}... receives {top_count}/{real_total_out} real outbound transfers ({total_out} total outbound transfers) — possible admin drain sink",
                })
                behavioral_score += 25

    # ── 4. Deployer dump: deployer is top seller shortly after deploy ─────────
    if normal_txs:
        # First tx is likely deploy
        deploy_tx = normal_txs[-1] if normal_txs else None
        deployer = _addr(deploy_tx, "from") if deploy_tx else ""
        if deployer:
            deployer_out = [t for t in outbound if _addr(t, "from") == addr and _addr(t, "to") == deployer]
            deployer_in_value = sum(_value(t) for t in inbound if _addr(t, "from") == deployer)
            deployer_out_value = sum(_value(t) for t in outbound if _addr(t, "to") == deployer)
            if deployer_out_value > deployer_in_value * 2 and deployer_out_value > 0:
                findings.append({
                    "label": f"Deployer extraction: deployer received {deployer_out_value:.2f} vs invested {deployer_in_value:.2f}",
                    "severity": "critical",
                    "detail": f"Deployer ({deployer[:10]}...) extracted significantly more than they put in — rug pull signal",
                })
                behavioral_score += 40

    # ── 5. Rapid launch pattern: high activity within first 24h near deployment ─
    if all_transfers:
        timestamps = [_ts(t) for t in all_transfers if _ts(t)]
        if len(timestamps) >= 2:
            timestamps.sort()
            first_ts = timestamps[0]
            last_ts = timestamps[-1]
            span_hours = (last_ts - first_ts).total_seconds() / 3600

            # Only consider this a "launch" if the burst happened near deployment.
            # Require a deployment timestamp and that the first transfer occurred
            # within 48 hours of deployment. This avoids flagging mature, high-volume contracts.
            is_near_deploy = False
            if creation_time:
                try:
                    delta_hours = (first_ts - creation_time).total_seconds() / 3600
                    if 0 <= delta_hours <= 48:
                        is_near_deploy = True
                except Exception:
                    is_near_deploy = False

            if len(timestamps) >= 10 and span_hours <= 24 and is_near_deploy:
                findings.append({
                    "label": f"High-velocity launch: {len(timestamps)} transfers in {span_hours:.1f}h",
                    "severity": "medium",
                    "detail": "Intense early activity often seen in pump-and-dump or coordinated rug setups",
                })
                behavioral_score += 15

    # ── 6. Failed transactions clustering (sell reverts) ─────────────────────
    if normal_txs:
        failed = [t for t in normal_txs if str(t.get("isError", "0")) == "1" or t.get("txreceipt_status") == "0"]
        if failed:
            fail_rate = len(failed) / len(normal_txs)
            if fail_rate > 0.3 and len(failed) >= 3:
                findings.append({
                    "label": f"High failure rate: {len(failed)}/{len(normal_txs)} txs failed ({fail_rate:.0%})",
                    "severity": "high",
                    "detail": "Many reverted transactions — consistent with sell restrictions or honeypot behavior",
                })
                behavioral_score += 25

    # ── 7. Circular / wash transfer detection ────────────────────────────────
    if len(all_transfers) >= 4:
        addr_pairs = Counter()
        for t in all_transfers:
            frm = _addr(t, "from")
            to = _addr(t, "to")
            if frm and to and frm != addr and to != addr:
                pair = tuple(sorted([frm, to]))
                addr_pairs[pair] += 1
        circular = [(p, c) for p, c in addr_pairs.items() if c >= 3]
        if circular:
            findings.append({
                "label": f"Circular transfer pattern: {len(circular)} address pair(s) trading back and forth",
                "severity": "medium",
                "detail": "Repeated transfers between same addresses — possible wash trading to inflate volume",
            })
            behavioral_score += 15

    # ── 8. Zero-value transfer spam ───────────────────────────────────────────
    zero_val = [t for t in inbound if _value(t) == 0]
    if len(zero_val) >= 5 and len(zero_val) > total_in * 0.5:
        findings.append({
            "label": f"Zero-value transfer spam: {len(zero_val)}/{total_in} inbound transfers have $0 value",
            "severity": "low",
            "detail": "Mass zero-value transfers used for phishing airdrop attacks to populate wallet UIs",
        })
        behavioral_score += 10

    # ── 9. Function call analysis from tx input data ──────────────────────────
    called_functions = Counter()
    dangerous_calls_seen = []

    for tx in normal_txs:
        fn = _decode_function(tx)
        if fn:
            called_functions[fn] += 1
            if fn in DANGEROUS_CALLS and fn not in dangerous_calls_seen:
                dangerous_calls_seen.append(fn)

    if dangerous_calls_seen:
        findings.append({
            "label": f"Dangerous functions called on-chain: {', '.join(dangerous_calls_seen)}",
            "severity": "high",
            "detail": f"Transaction history confirms these high-risk functions were actually executed: {', '.join(dangerous_calls_seen)}",
        })
        behavioral_score += 20

    # ── Build summary string ──────────────────────────────────────────────────
    summary_lines = [
        f"Inbound transfers: {total_in} (from {unique_senders} unique senders)",
        f"Outbound transfers: {total_out}",
        f"Current ETH balance: {balance_eth:.6f} ETH",
    ]
    if normal_txs:
        failed_count = len([t for t in normal_txs if str(t.get("isError", "0")) == "1"])
        summary_lines.append(f"Normal txs: {len(normal_txs)} total, {failed_count} failed/reverted")

    if called_functions:
        top_calls = ", ".join(f"{fn}×{c}" for fn, c in called_functions.most_common(5))
        summary_lines.append(f"Functions called: {top_calls}")

    if findings:
        summary_lines.append("")
        summary_lines.append("Behavioral findings:")
        for f in findings:
            summary_lines.append(f"  [{f['severity'].upper()}] {f['label']}")
            summary_lines.append(f"    {f['detail']}")

    return {
        "findings": findings,
        "summary": "\n".join(summary_lines),
        "behavioral_score": behavioral_score,
        "called_functions": dict(called_functions),
        "dangerous_calls_seen": dangerous_calls_seen,
        "stats": {
            "total_in": total_in,
            "total_out": total_out,
            "unique_senders": unique_senders,
            "balance_eth": balance_eth,
            "normal_tx_count": len(normal_txs),
        },
    }