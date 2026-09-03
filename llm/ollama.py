"""
llm/ollama.py — Local LLM reasoning via Ollama.

Sends structured contract context to a local Ollama model and gets back
a human-readable security analysis. Falls back gracefully if Ollama is
not running.
"""

import os
import json
import requests

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:2b")


def _ollama_available() -> bool:
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
        if r.status_code != 200:
            return False
        # Check the model we need is actually pulled
        tags = r.json().get("models", [])
        model_names = [m.get("name", "") for m in tags]
        available = any(OLLAMA_MODEL in name for name in model_names)
        if not available:
            print(f"    [LLM] Model '{OLLAMA_MODEL}' not found. Run: ollama pull {OLLAMA_MODEL}")
        return available
    except Exception:
        return False


def analyze_contract(
    address: str,
    bytecode_size: int,
    is_proxy: bool,
    found_selectors: list[dict],
    found_opcodes: list[dict],
    source_findings: list[dict],
    source_code_snippet: str,
    contract_name: str,
    source_verified: bool,
    score: int,
    breakdown: list[str],
    similar_scams: list[dict],
    tx_summary: str,
) -> str:
    """
    Ask local LLM to produce a human-readable security report.
    When source is verified, passes the focused Solidity snippet to the LLM
    for direct code-level reasoning — significantly better than bytecode alone.
    Returns the LLM's analysis string, or a rule-based fallback if Ollama isn't running.
    """
    if not _ollama_available():
        return _fallback_report(
            address, score, breakdown, found_selectors, found_opcodes,
            source_findings, similar_scams, source_verified
        )

    selector_list = "\n".join(
        f"  - {s['label']} ({'HIGH RISK' if s['high_risk'] else 'noted'})"
        for s in found_selectors
    ) or "  None detected"

    opcode_list = "\n".join(
        f"  - {o['label']}" for o in found_opcodes
    ) or "  None"

    source_finding_list = "\n".join(
        f"  - {f['label']} ({'HIGH RISK' if f['high_risk'] else 'noted'})"
        for f in source_findings
    ) or "  None detected"

    scam_list = "\n".join(
        f"  - [{r['similarity']:.0%} match] {r['pattern']}"
        for r in similar_scams
    ) or "  No strong matches"

    source_section = ""
    signals = []
    for o in found_opcodes:
        signals.append(o["label"])
    for s in found_selectors:
        if s.get("high_risk"):
            signals.append(s["label"])
    for f in source_findings:
        if f.get("high_risk"):
            signals.append(f["label"])

    # `tx_summary` is a human-readable multi-line string produced by
    # `core.tx_analysis.analyze_transactions()`. Use it directly for
    # the Transaction behavior section in the LLM prompt.
    signal_lines = "\n".join(f"- {s}" for s in signals[:5]) or "- none"
    behavior_lines = tx_summary if isinstance(tx_summary, str) and tx_summary.strip() else "- none"

    prompt = f"""Analyze this Ethereum smart contract security report. Address EVERY finding listed below.

Contract: {address}
Risk score: {score}

Code signals:
{signal_lines}

Transaction behavior:
{behavior_lines}

For each finding above, explain in one sentence how it harms users. Then give a one-sentence recommendation. Do not mention findings not listed above."""

    try:
        r = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "keep_alive": "10m",
                "options": {"temperature": 0.1, "num_predict": 150},
            },
            timeout=180,
        )
        data = r.json()
        response = data.get("response", "").strip()
        if not response:
            print(f"    [LLM] Empty response from model. Status: {r.status_code}, keys: {list(data.keys())}")
        return response
    except Exception as e:
        print(f"    [LLM] Error: {e}")
        return _fallback_report(
            address, score, breakdown, found_selectors, found_opcodes,
            source_findings, similar_scams, source_verified
        )


def _fallback_report(
    address, score, breakdown, found_selectors, found_opcodes,
    source_findings, similar_scams, source_verified
) -> str:
    """Rule-based report when Ollama is unavailable."""
    mode = "verified source + bytecode" if source_verified else "bytecode-only (unverified)"
    lines = [
        f"[RiskSearcher | Rule-based analysis | {mode}]",
        "",
        f"Contract: {address}",
        f"Risk Score: {score}",
        "",
    ]

    if source_findings:
        lines.append("Source-level findings (Solidity regex):")
        for f in source_findings:
            tag = " ⚠ HIGH RISK" if f["high_risk"] else ""
            lines.append(f"  • {f['label']}{tag}")
        lines.append("")

    if found_selectors:
        lines.append("Bytecode selector findings:")
        for s in found_selectors:
            tag = " ⚠ HIGH RISK" if s["high_risk"] else ""
            lines.append(f"  • {s['label']}{tag}")
        lines.append("")

    if found_opcodes:
        lines.append("Dangerous opcodes:")
        for o in found_opcodes:
            lines.append(f"  • {o['label']}")
        lines.append("")

    if breakdown:
        lines.append("Score breakdown:")
        for b in breakdown:
            lines.append(f"  {b}")
        lines.append("")

    if similar_scams:
        lines.append("Similar known scam patterns:")
        for s in similar_scams:
            lines.append(f"  [{s['similarity']:.0%}] {s['pattern']}")
        lines.append("")

    return "\n".join(lines)