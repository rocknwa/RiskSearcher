"""Markdown report generation for completed contract analyses."""

from __future__ import annotations

import re
from pathlib import Path


def _specialist(result) -> tuple[dict | None, str]:
    for finding in result.specialist_findings or []:
        if finding.get("id") == "token_risk":
            specialist = finding.get("result") or {}
            return specialist, specialist.get("response", "") or ""
    return None, ""


def _graph_layer_status(graph_evidence: dict | None) -> str:
    graph = graph_evidence or {}
    if graph.get("no_data", True):
        return f"unavailable ({graph.get('reason', 'no data')})"
    if not graph.get("pools_data_reliable", True):
        return "fetched live (TVL only — pool-level detail unavailable, see note below)"
    return "fetched live"


def render_markdown_report(result) -> str:
    """Render an AnalysisResult as a human-readable Markdown report."""
    specialist, specialist_response = _specialist(result)
    layers = [
        "- Bytecode scan: ran",
        f"- Source scan: {'ran (verified source)' if result.source_verified else 'did not run (contract source is unverified)'}",
        "- Behavioral analysis: ran",
        f"- The Graph / Uniswap V3 liquidity evidence: {_graph_layer_status(result.graph_evidence)}",
    ]
    if specialist_response:
        layers.append("- LLM specialist: ran (token-risk specialist — balance/access-control, liquidity, mint privilege, trading controls, upgradeability, ownership, and honeypot/sell-blocking patterns)")
    else:
        reason = (specialist or {}).get("error") or "no specialist response was produced"
        layers.append(f"- LLM specialist: unavailable this run: {reason}")

    lines = [
        f"# Contract Risk Report: {result.address}",
        "",
        f"## Verdict: {result.verdict.upper()}",
        "",
        f"- **Address:** `{result.address}`",
        f"- **Verdict:** {result.verdict.upper()}",
        f"- **Severity:** {result.severity or 'n/a'}",
        f"- **Risk score:** {result.score}",
        f"- **Verdict source:** {'LLM judge' if result.verdict_source == 'llm_judge' else 'Rule-based analysis only'}",
        f"- **Rule-based score (kept for reference):** {result.rule_score}",
        "",
        "## How this was assessed",
        "",
        *layers,
        "",
        "## Score breakdown",
        "",
    ]
    lines.append(f"- Score source: {result.score_source.replace('_', ' ').title()}")
    lines.extend(f"- {item}" for item in (result.breakdown or ["No risk signals detected"]))

    lines.extend(["", "## Bytecode selectors found", ""])
    if result.bytecode_selectors:
        lines.extend(
            f"- `{item.get('label', 'unknown')}`"
            f"{' (high risk)' if item.get('high_risk') else ''}"
            for item in result.bytecode_selectors
        )
    else:
        lines.append("- None detected")
    if result.bytecode_opcodes:
        lines.extend(f"- Opcode: `{item.get('label', 'unknown')}`" for item in result.bytecode_opcodes)

    lines.extend(["", "## Source-level findings", ""])
    if result.source_findings_list:
        lines.extend(
            f"- {item.get('label', 'Unnamed finding')}"
            f"{' (high risk)' if item.get('high_risk') else ''}"
            for item in result.source_findings_list
        )
    else:
        lines.append("- None detected")

    lines.extend(["", "## Behavioral findings", ""])
    if result.behavioral_findings:
        for item in result.behavioral_findings:
            lines.append(f"- **{str(item.get('severity', 'unknown')).upper()}:** {item.get('label', 'Unnamed finding')}")
            if item.get("detail"):
                lines.append(f"  {item['detail']}")
    else:
        lines.append("- None detected")

    lines.extend(["", "## The Graph liquidity evidence", ""])
    graph = result.graph_evidence or {}
    if graph and not graph.get("no_data", True):
        volumes = graph.get("recent_swap_volume_usd") or {}
        pools_reliable = graph.get("pools_data_reliable", True)
        volume_24h = volumes.get("24h")
        volume_7d = volumes.get("7d")
        lines.extend([
            "- **Source:** The Graph — Uniswap V3 Ethereum mainnet subgraph",
            f"- **Pool count:** {graph.get('pool_count', 0)}{'' if graph.get('pool_count_exact', True) else '+'}",
            f"- **Total liquidity (USD):** ${float(graph.get('total_liquidity_usd') or 0):,.2f}",
            f"- **First observed swap timestamp:** {graph.get('first_swap_timestamp') or 'not available'}",
            (
                f"- **Recent swap volume:** ${float(volume_24h or 0):,.2f} (24h); ${float(volume_7d or 0):,.2f} (7d)"
                if pools_reliable
                else "- **Recent swap volume:** not available this run (pool-level detail unreliable — see note below)"
            ),
            "- **Verdict use:** The token-risk specialist was instructed to assess liquidity depth, pool age, and volume/liquidity mismatches as legitimacy signals.",
        ])
        if not pools_reliable:
            lines.append(
                "- **Note:** Total liquidity (USD) came back nonzero but pool-level detail "
                "(pool count, swap age, volume) did not. That combination is internally "
                "inconsistent, so pool-level figures above are marked unavailable rather than "
                "shown as confirmed zero, and were not treated as a safety signal."
            )
    else:
        lines.append(f"- Unavailable this run: {graph.get('reason', 'no Graph data returned')}. This was not treated as a safety signal.")

    lines.extend(["", "## Similar known-scam matches", ""])
    if result.similar_scams:
        lines.extend(
            f"- {item.get('pattern', 'Unnamed pattern')} (similarity: {item.get('similarity', 'n/a')})"
            for item in result.similar_scams
        )
    else:
        lines.append("- None found")

    lines.extend(["", "## Specialist analysis", ""])
    if specialist_response:
        lines.append(specialist_response.strip())
    else:
        lines.append("LLM analysis unavailable this run; see the reason in the assessment layers above.")

    lines.extend([
        "",
        "This report is an advisory signal, not a final verdict, and should be independently verified.",
        "",
    ])
    return "\n".join(lines)


def write_markdown_report(result, reports_dir: str | Path = "reports") -> Path:
    """Write the completed result to a stable, concise report filename."""
    reports_path = Path(reports_dir)
    reports_path.mkdir(parents=True, exist_ok=True)
    if result.source_verified and result.contract_name:
        stem = f"{result.contract_name}_{result.address[:2]}{result.address[2:10]}"
    else:
        stem = result.address
    stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", stem)
    report_path = reports_path / f"{stem}.md"
    report_path.write_text(render_markdown_report(result), encoding="utf-8")
    return report_path
