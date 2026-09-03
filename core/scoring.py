"""
core/scoring.py — Risk scoring engine.

Aggregates signals from bytecode rules, RPC context, and transfer history
into a single numeric risk score and verdict.
"""

import os

THREAT_THRESHOLD = int(os.environ.get("THREAT_THRESHOLD", "30"))


def compute_score(
    rules_result: dict,
    rpc_context: dict,
    tx_analysis: dict,
    similar_scams: list,
    source_findings: dict = None,
) -> dict:
    """
    Compute risk score and return structured findings.

    Score breakdown (max ~200+):
      Bytecode signals:
        - Admin fund control functions:          +40
        - Transfer restriction functions:        +30
        - Upgradeability (unguarded):            +15
        - Uncapped mint / admin burn:            +10
        - SELFDESTRUCT opcode:                   +50
        - Proxy detected:                        +10
      Source signals (when verified):
        - High-risk source findings:             +15 each (cap +45)
        - Other source signals:                  +5 each (cap +20)
        - Dual-layer corroboration bonus:        +10
      Behavioral signals (tx history):
        - Honeypot (in but no out):              +35
        - Drain pattern (many senders, 0 bal):   +30
        - Outbound concentration:                +25
        - Deployer extraction / dump:            +40
        - High failure rate (sell reverts):      +25
        - Rapid launch high-velocity:            +15
        - Circular / wash trades:                +15
        - Zero-value spam:                       +10
      Similarity signals:
        - Similar known scam in DB:              +20 each (cap +40)
    """
    score = 0
    breakdown = []

    # ── Bytecode selector signals ─────────────────────────────────────────────
    fund_control_selectors = {
        "0x947bc65f", "0x9e281a98", "0xdb006a75",
        "0xcee2b5ef", "0x5e8ab3b5",
    }
    restriction_selectors = {
        "0x44337ea1", "0xe4997dc5", "0x8f9a55a0",
        "0x35ba5098", "0x8456cb59", "0x3f4ba83a",
    }
    upgrade_selectors = {"0x3659cfe6", "0x4f1ef286"}
    mint_burn_selectors = {"0x40c10f19", "0x42966c68", "0x9dc29fac", "0xf5537ede"}

    found = {s["selector"] for s in rules_result.get("found_selectors", [])}

    if found & fund_control_selectors:
        score += 40
        matched = [
            s["label"] for s in rules_result["found_selectors"]
            if s["selector"] in fund_control_selectors
        ]
        breakdown.append(f"+40 Admin fund control: {', '.join(matched)}")

    if found & restriction_selectors:
        score += 30
        matched = [
            s["label"] for s in rules_result["found_selectors"]
            if s["selector"] in restriction_selectors
        ]
        breakdown.append(f"+30 Transfer restrictions: {', '.join(matched)}")

    if found & upgrade_selectors:
        score += 15
        breakdown.append("+15 Upgradeability functions present (proxy upgrade risk)")

    if found & mint_burn_selectors:
        score += 10
        matched = [
            s["label"] for s in rules_result["found_selectors"]
            if s["selector"] in mint_burn_selectors
        ]
        breakdown.append(f"+10 Mint/burn control: {', '.join(matched)}")

    # ── Opcode signals ─────────────────────────────────────────────────────────
    for op in rules_result.get("found_opcodes", []):
        score += 50
        breakdown.append(f"+50 CRITICAL OPCODE: {op['label']}")

    # ── RPC context signals ────────────────────────────────────────────────────
    if rpc_context.get("is_proxy"):
        score += 10
        breakdown.append("+10 Proxy contract detected (EIP-1967)")

    if not rpc_context.get("is_contract") and rpc_context.get("bytecode_size", 0) == 0:
        score += 5
        breakdown.append("+5 No bytecode (EOA or self-destructed)")

    # ── Behavioral signals from tx_analysis ───────────────────────────────────
    behavioral_score = tx_analysis.get("behavioral_score", 0)
    if behavioral_score > 0:
        score += behavioral_score
        for finding in tx_analysis.get("findings", []):
            sev = finding.get("severity", "")
            label = finding.get("label", "")
            breakdown.append(f"  [BEHAVIOR/{sev.upper()}] {label}")

    # ── Vector similarity signals ──────────────────────────────────────────────
    sim_score = min(len(similar_scams) * 20, 40)
    if sim_score > 0:
        score += sim_score
        breakdown.append(
            f"+{sim_score} Similar to {len(similar_scams)} known scam pattern(s) in DB"
        )

    # ── Source code signals (only when verified source available) ──────────────
    if source_findings and source_findings.get("findings"):
        findings = source_findings["findings"]
        hr_findings = [f for f in findings if f["high_risk"]]
        other_findings = [f for f in findings if not f["high_risk"]]

        if hr_findings:
            src_score = min(len(hr_findings) * 15, 45)
            score += src_score
            labels = ", ".join(f["label"] for f in hr_findings[:3])
            breakdown.append(
                f"+{src_score} Source-confirmed high-risk: {labels}"
                + (f" (+{len(hr_findings)-3} more)" if len(hr_findings) > 3 else "")
            )

        if other_findings:
            src_score = min(len(other_findings) * 5, 20)
            score += src_score
            labels = ", ".join(f["label"] for f in other_findings[:3])
            breakdown.append(f"+{src_score} Source-level risk signals: {labels}")

        if hr_findings and rules_result.get("high_risk_count", 0) > 0:
            score += 10
            breakdown.append("+10 Source + bytecode corroboration (dual-layer confirmation)")

    # ── Verdict and severity ───────────────────────────────────────────────────

    verdict = "threat" if score >= THREAT_THRESHOLD else "safe"

    # Map score to severity
    if score >= 80:
        severity = "critical"
    elif score >= 50:
        severity = "high"
    elif score >= 30:
        severity = "medium"
    elif score >= 10:
        severity = "low"
    else:
        severity = ""

    return {
        "score": score,
        "verdict": verdict,
        "severity": severity,
        "breakdown": breakdown,
        "threshold": THREAT_THRESHOLD,
    }
