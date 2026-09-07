"""
core/analyzer.py — RiskSearcher analysis orchestrator.

Pipeline:
  1. Etherscan source fetch (primary)
  2. RPC bytecode + chain context
  3. Source-code rules scan
  4. Bytecode rules scan (always)
  5. Scoring (source + bytecode combined)
  6. FAISS vector retrieval
  7. LLM report
  8. Format human-readable risk summary
"""

import json
import os
from dataclasses import dataclass, asdict
from typing import Callable

from rpc.graph_provider import get_token_liquidity_data
from rpc.provider import get_contract_context, get_transfer_history, get_source_code
from core.rules import scan_bytecode, scan_source
from core.scoring import compute_score
from core.tx_analysis import analyze_transactions
from db.vector_store import retrieve_similar
from llm.ollama import analyze_contract
from llm.client import run_judge, run_specialist

TOOL_NAME = os.environ.get("TOOL_NAME", "RiskSearcher")

DANGEROUS_SUBMISSION_CALLS = {
    "recoverFunds()", "rescueTokens()", "rescue()", "adminWithdraw()",
    "mint()", "pause()", "blacklist()", "setBlacklist()", "blockAddress()",
    "upgradeTo()", "upgradeToAndCall()", "openTrading()", "transferOwnership()",
}


@dataclass
class AnalysisResult:
    address: str
    verdict: str
    severity: str
    score: int
    breakdown: list[str]
    llm_report: str
    similar_scams: list[dict]
    source_verified: bool
    contract_name: str
    bytecode_selectors: list[dict] = None
    bytecode_opcodes: list[dict] = None
    source_findings_list: list[dict] = None
    behavioral_findings: list[dict] = None
    called_functions: dict = None
    specialist_findings: list[dict] = None
    comment: str = ""
    judge_error: str = ""
    final_reason: str = ""
    rule_score: int = 0
    score_source: str = "rule_based"
    verdict_source: str = "rule_based"
    graph_evidence: dict = None

    def to_dict(self) -> dict:
        data = asdict(self)
        return {
            "address": data["address"],
            "verdict": data["verdict"],
            "severity": data["severity"],
            "score": data["score"],
            "rule_score": data.get("rule_score", 0),
            "score_source": data.get("score_source", "rule_based"),
            "verdict_source": data.get("verdict_source", "rule_based"),
            "breakdown": data["breakdown"],
            "llm_report": data["llm_report"],
            "similar_scams": data["similar_scams"],
            "source_verified": data["source_verified"],
            "contract_name": data["contract_name"],
            "bytecode_selectors": data.get("bytecode_selectors") or [],
            "bytecode_opcodes": data.get("bytecode_opcodes") or [],
            "source_findings_list": data.get("source_findings_list") or [],
            "behavioral_findings": data.get("behavioral_findings") or [],
            "specialist_findings": data.get("specialist_findings") or [],
            "called_functions": data.get("called_functions") or {},
            "comment": data.get("comment", ""),
            "judge_error": data.get("judge_error", ""),
            "final_reason": data.get("final_reason", ""),
            "graph_evidence": data.get("graph_evidence") or {},
        }

    def format_comment(self, tool_name: str = TOOL_NAME) -> str:
        src_tag = (
            f"✓ Verified source ({self.contract_name})"
            if self.source_verified
            else "Bytecode analysis (source unverified)"
        )
        lines = [
            f"[{tool_name} | Automated risk analysis]",
            f"Analysis mode: {src_tag}",
            "",
            f"Verdict: {self.verdict.upper()}",
            f"Severity: {self.severity or 'n/a'}",
            f"Risk Score: {self.score}",
            "",
            "--- Detected Signals ---",
        ]

        if self.bytecode_selectors:
            lines.append("Bytecode selectors:")
            for s in self.bytecode_selectors:
                tag = " [HIGH RISK]" if s.get("high_risk") else ""
                lines.append(f"  • {s['label']}{tag}")

        if self.bytecode_opcodes:
            for o in self.bytecode_opcodes:
                lines.append(f"  • OPCODE: {o['label']}")

        if self.source_findings_list:
            lines.append("Source code findings:")
            for f in self.source_findings_list:
                tag = " [HIGH RISK]" if f.get("high_risk") else ""
                lines.append(f"  • {f['label']}{tag}")

        if self.behavioral_findings:
            lines.append("Transaction behavior:")
            for f in self.behavioral_findings:
                lines.append(f"  • [{f['severity'].upper()}] {f['label']}")
                lines.append(f"    {f['detail']}")

        if self.called_functions:
            lines.append("Functions called on-chain:")
            for fn, count in sorted(self.called_functions.items(), key=lambda x: -x[1])[:8]:
                tag = " ⚠" if fn in DANGEROUS_SUBMISSION_CALLS else ""
                lines.append(f"  • {fn} ×{count}{tag}")

        lines += ["", "--- Score Breakdown ---"]
        if self.breakdown:
            lines += [f"  {b}" for b in self.breakdown]
        else:
            lines.append("  No risk signals detected")

        if self.llm_report and not self.llm_report.startswith("[RiskSearcher"):
            lines += ["", "--- Analysis ---", self.llm_report]

        return "\n".join(lines)


def analyze(
    address: str,
    ticket_meta: dict = None,
    chain: str | None = "ethereum",
    on_progress: Callable[[str], None] | None = None,
) -> AnalysisResult:
    """Full analysis pipeline for a single contract address.

    on_progress, if given, is called with each stage-marker string in
    addition to the normal print() — this is how the API/SSE server streams
    live progress to the frontend without changing any pipeline logic.
    The CLI (main.py) doesn't pass this, so its behavior is unchanged.
    """

    def _emit(msg: str) -> None:
        print(msg)
        if on_progress:
            try:
                on_progress(msg)
            except Exception:
                pass  # never let a UI callback break the actual analysis

    _emit("[1/5] Fetching contract source...")
    src = get_source_code(address, chain=chain)
    source_verified = src["verified"]
    source_code = src["source_code"]
    contract_name = src.get("contract_name", "")

    if source_verified:
        _emit(f"    [SOURCE] Verified: {contract_name}")
    else:
        _emit(f"    [SOURCE] Unverified — bytecode only")

    _emit("[2/5] Running rule-based analysis...")
    rpc_ctx = get_contract_context(address, chain=chain)
    graph_evidence = get_token_liquidity_data(address, chain or "ethereum")

    transfers = get_transfer_history(address, limit=200, chain=chain)
    try:
        creation_time = get_contract_creation_time(address, chain=chain)
    except Exception:
        creation_time = None

    tx_analysis = analyze_transactions(
        address=address,
        inbound=transfers["inbound"],
        outbound=transfers["outbound"],
        normal_txs=transfers["normal_txs"],
        balance_eth=rpc_ctx.get("balance_eth", 0.0),
        creation_time=creation_time,
    )

    if source_verified and src.get("is_proxy"):
        rpc_ctx["is_proxy"] = True
        rpc_ctx["impl_address"] = src.get("implementation") or rpc_ctx.get("impl_address")

    if source_verified:
        source_files = src.get("sources") or {}
        source_findings = scan_source(source_files, contract_name=contract_name)
    else:
        source_findings = {"findings": [], "high_risk_count": 0}
    bytecode_rules = scan_bytecode(rpc_ctx.get("bytecode_hex", ""))

    if source_verified and source_findings["findings"]:
        labels = [f["label"] for f in source_findings["findings"]]
    else:
        labels = (
            [s["label"] for s in bytecode_rules["found_selectors"]]
            + [o["label"] for o in bytecode_rules["found_opcodes"]]
        )
    behavioral_labels = [f["label"] for f in tx_analysis["findings"]]
    all_labels = labels + behavioral_labels
    description = (
        f"contract with {', '.join(all_labels)}"
        if all_labels
        else "standard contract with no flagged patterns"
    )

    similar = retrieve_similar(description, top_k=3)
    scoring = compute_score(
        bytecode_rules, rpc_ctx, tx_analysis, similar, source_findings
    )
    rule_score = int(scoring.get("score", 0))
    final_score = rule_score
    score_source = "rule_based"
    verdict_source = "rule_based"

    # --- Build specialist context (explicit branch) ---------------------
    if source_verified:
        specialist_context = {
            "mode": "source",
            "contract_name": contract_name,
            "source_files": source_files if source_verified else {},
            "behavioral": tx_analysis,
            "similar": similar,
            "graph_evidence": graph_evidence,
        }
    else:
        specialist_context = {
            "mode": "bytecode",
            "contract_name": contract_name,
            "bytecode_findings": bytecode_rules,
            "behavioral": tx_analysis,
            "similar": similar,
            "graph_evidence": graph_evidence,
        }

    token_risk_prompt = (
        f"You are a security auditor specializing in token-holder risk: the ways a token "
        f"contract's owner or deployer can harm buyers after launch, even without an "
        f"obvious hack.\n"
        f"Context mode: {specialist_context['mode']}\n"
        f"Contract: {contract_name}\n\n"
        "LIQUIDITY EVIDENCE INSTRUCTIONS: The Graph evidence below is live Uniswap V3 "
        "Ethereum-mainnet data. Treat clearly flagged no_data as unavailable evidence, not "
        "as proof of safety or risk. When data is available, assess whether very thin or "
        "very new liquidity, or swap volume disproportionate to liquidity, changes the "
        "legitimacy/rug-pull assessment. State the observed figures and explain the signal; "
        "do not infer LP-lock status from these figures alone.\n\n"
    )
    if specialist_context["mode"] == "source":
        token_risk_prompt += (
            "Analyze the source code against the following categories of token-holder "
            "risk. Report only what you actually find — for each category where a real "
            "risk exists, state it clearly with line references and a concise "
            "explanation of the mechanism. Do not mention categories where you find "
            "nothing; do not speculate about absence.\n\n"
            "1. BALANCE / ACCESS-CONTROL GATING — overridden view functions, gated or "
            "conditional balance checks, or transfer/sell logic that behaves differently "
            "depending on msg.sender or tx.origin.\n"
            "2. LIQUIDITY-PULL RISK — can the owner or deployer remove liquidity from the "
            "trading pair unilaterally? Is LP explicitly locked or burned, or is there no "
            "such protection?\n"
            "3. MINT-PRIVILEGE ABUSE — can the owner mint new supply after launch with no "
            "cap or timelock, diluting or enabling a dump against existing holders?\n"
            "4. TRADING-CONTROL TOGGLES — owner-controlled pause, blacklist, or max-"
            "transaction/max-wallet functions that could freeze sells or target specific "
            "holders after launch, even if framed as 'anti-bot' protection.\n"
            "5. UPGRADEABILITY / PROXY RISK — is this a proxy contract where the "
            "implementation can be swapped by the owner after launch, letting clean-"
            "looking logic today be replaced later without holder consent?\n"
            "6. OWNERSHIP STATUS — is ownership renounced, or does a live owner address "
            "still hold any of the privileges above? If renounced, note which functions "
            "become permanently inert as a result.\n"
            "7. HONEYPOT / SELL-SPECIFIC BLOCKING — does sell behave differently from "
            "buy in a way that would trap holders? Look for: asymmetric buy vs. sell tax, "
            "a sell-path-specific revert or require(false), a sell-only allowlist/"
            "blacklist, or any condition that lets tokens be bought freely but not sold.\n\n"
        )
        token_risk_prompt += "SOURCE_FILES:\n"
        for name, content in (specialist_context.get("source_files") or {}).items():
            token_risk_prompt += f"-- {name} --\n{content.get('content','')}\n\n"
    else:
        token_risk_prompt += (
            "You have only bytecode-derived findings and behavioral traces. Assess the "
            "following categories of token-holder risk against the available selectors, "
            "opcodes, and transfer history. Report only what you actually find — for "
            "each category where the evidence supports a real risk, state it clearly and "
            "cite the bytecode evidence. Do not mention categories where you find "
            "nothing; do not speculate about absence.\n\n"
            "1. BALANCE / ACCESS-CONTROL GATING — could a balance or visibility check be "
            "present that gates behavior by caller? Cite the bytecode evidence.\n"
            "2. LIQUIDITY-PULL RISK — do selectors suggest an owner-only liquidity-removal "
            "or withdrawal function?\n"
            "3. MINT-PRIVILEGE ABUSE — is a mint() or equivalent selector present with no "
            "visible cap/timelock pattern in the opcodes?\n"
            "4. TRADING-CONTROL TOGGLES — do selectors suggest pause/blacklist/max-tx "
            "style functions?\n"
            "5. UPGRADEABILITY / PROXY RISK — do opcodes/selectors indicate a proxy "
            "pattern (e.g. DELEGATECALL to a mutable address)?\n"
            "6. OWNERSHIP STATUS — do opcodes suggest an active onlyOwner-style modifier "
            "is still reachable?\n"
            "7. HONEYPOT / SELL-SPECIFIC BLOCKING — do selectors, opcodes, or transfer "
            "history suggest sell behaves differently from buy (asymmetric tax, a sell-"
            "path-specific revert, or transactions showing buys succeeding while sells "
            "fail or revert)?\n\n"
        )
        token_risk_prompt += "BYTECODE_FINDINGS:\n"
        token_risk_prompt += str(specialist_context.get("bytecode_findings") or {})[:4000]

    token_risk_prompt += "\nGRAPH_LIQUIDITY_EVIDENCE:\n"
    token_risk_prompt += json.dumps(specialist_context["graph_evidence"], sort_keys=True)
    token_risk_prompt += "\nBEHAVIORAL_SUMMARY:\n"
    token_risk_prompt += tx_analysis.get("summary", "")[:2000]

    _emit("[3/5] Running specialist analysis...")
    try:
        specialist_result = run_specialist("token_risk", token_risk_prompt)
    except Exception as exc:
        specialist_result = {"backend": "none", "response": "", "error": str(exc), "_simulated": False}

    specialist_success = False
    if specialist_result.get("_simulated") is True:
        specialist_success = False
    elif specialist_result.get("backend") not in (None, "", "none"):
        if (specialist_result.get("response") or "").strip():
            if not specialist_result.get("error"):
                specialist_success = True

    if specialist_success:
        _emit("    [LLM] Specialist: returned usable response")
    else:
        _emit("    [LLM] Specialist: no usable response; running judge on rule findings alone")

    # The judge pass always runs now, even when the specialist couldn't get
    # a response (source too large for a backend's free-tier limits, every
    # backend rate-limited, etc). Rule findings alone are a tiny payload —
    # just the label/score breakdown, not source code — so this fits well
    # under Groq's free-tier TPM ceiling regardless of contract size, and
    # it's what actually catches cases like a low-scoring rule hit (e.g. an
    # internal _mint() call with no supply cap) that's genuinely severe but
    # would otherwise ship as "SAFE" purely because no specialist ever
    # reviewed it. When there's no specialist response to reuse a backend
    # from, the judge runs its own independent
    # Anthropic -> OpenRouter -> Groq -> AgentRouter fallback chain instead
    # of inheriting the specialist's (failed) one.
    if specialist_success:
        _emit("[4/5] Running judge pass...")
        judge_specialist_findings = specialist_result.get("response", "")
        judge_provider = specialist_result.get("provider")
        judge_model = specialist_result.get("model")
    else:
        _emit("[4/5] Running judge pass (rule findings only — specialist unavailable)...")
        judge_specialist_findings = (
            "(No specialist LLM analysis was available — every backend was rate-limited, "
            "unreachable, or the source was too large to fit within a free-tier token limit. "
            "Evaluate ONLY the rule-based findings below and judge whether any of the named "
            "patterns represent a real, severe risk that the raw rule score may be "
            "under-representing — e.g. an unrestricted internal mint call is critical "
            "regardless of how few rule-engine points it was assigned.)"
        )
        judge_provider = None
        judge_model = None

    try:
        judge_result = run_judge(
            rule_findings=scoring,
            specialist_findings=judge_specialist_findings,
            address=address,
            chain=chain or "ethereum",
            provider=judge_provider,
            model=judge_model,
        )
    except Exception as exc:
        judge_result = {"verdict": "", "severity": "", "reason": "", "error": str(exc), "backend": "none"}

    if judge_result.get("verdict") and judge_result.get("reason"):
        final_verdict = judge_result["verdict"]
        final_severity = judge_result.get("severity") or scoring["severity"]
        final_reason = judge_result["reason"]
        if judge_result.get("score") is not None:
            final_score = int(judge_result["score"])
        else:
            final_score = _severity_to_score(final_severity)
        score_source = "llm_judge"
        verdict_source = "llm_judge"
        judge_error = ""
        _emit("    [LLM] Judge: returned final verdict/severity/reason")
    else:
        final_verdict = scoring["verdict"]
        final_severity = scoring["severity"]
        final_reason = "Rule-based verdict retained after judge failure"
        final_score = rule_score
        score_source = "rule_based"
        verdict_source = "rule_based"
        judge_error = judge_result.get("error") or "judge returned an invalid or empty response"
        _emit(f"    [LLM] Judge: failed ({judge_error}); retaining rule-based verdict")

    _emit("[5/5] Generating report...")
    llm_report = analyze_contract(
        address=address,
        bytecode_size=rpc_ctx.get("bytecode_size", 0),
        is_proxy=rpc_ctx.get("is_proxy", False),
        found_selectors=bytecode_rules["found_selectors"],
        found_opcodes=bytecode_rules["found_opcodes"],
        source_findings=source_findings.get("findings", []),
        source_code_snippet=_extract_snippet(source_code),
        contract_name=contract_name,
        source_verified=source_verified,
        score=scoring["score"],
        breakdown=scoring["breakdown"],
        similar_scams=similar,
        tx_summary=tx_analysis["summary"],
    )

    result = AnalysisResult(
        address=address,
        verdict=final_verdict,
        severity=final_severity,
        score=final_score,
        breakdown=scoring["breakdown"],
        llm_report=llm_report,
        similar_scams=similar,
        source_verified=source_verified,
        contract_name=contract_name,
        bytecode_selectors=bytecode_rules["found_selectors"],
        bytecode_opcodes=bytecode_rules["found_opcodes"],
        source_findings_list=source_findings.get("findings", []),
        behavioral_findings=tx_analysis.get("findings", []),
        called_functions=tx_analysis.get("called_functions", {}),
        specialist_findings=[{"id": "token_risk", "result": specialist_result}],
        comment=final_reason,
        judge_error=judge_error,
        final_reason=final_reason,
        rule_score=rule_score,
        score_source=score_source,
        verdict_source=verdict_source,
        graph_evidence=graph_evidence,
    )
    return result


def _severity_to_score(severity: str | None) -> int:
    s = (severity or "").strip().lower()
    if s in {"critical", "crit", "critical risk"}:
        return 95
    if s in {"high", "severe"}:
        return 80
    if s in {"medium", "moderate"}:
        return 60
    if s in {"low", "minor"}:
        return 30
    return 50


def _extract_snippet(source_code: str, max_chars: int = 3000) -> str:
    """
    Return a focused snippet of the source for the LLM prompt.
    Prioritizes the top of the file (imports, state vars, constructor)
    plus any function that contains a dangerous keyword.
    Caps at max_chars to avoid blowing the prompt budget.
    """
    if not source_code:
        return ""

    DANGER_KEYWORDS = [
        "selfdestruct", "rescue", "recoverFund", "blacklist", "freeze",
        "withdrawAll", "emergencyWithdraw", "canSell", "tradingEnabled",
        "mint(", "_mint(", "upgradeTo", "_authorizeUpgrade",
    ]

    lines = source_code.splitlines()
    selected = []
    current_fn = []
    in_fn = False
    fn_is_dangerous = False

    for line in lines:
        stripped = line.strip()

        # Start of a function
        if stripped.startswith("function ") or stripped.startswith("constructor"):
            if in_fn and fn_is_dangerous:
                selected.extend(current_fn)
            current_fn = [line]
            in_fn = True
            fn_is_dangerous = any(k in line for k in DANGER_KEYWORDS)
            continue

        if in_fn:
            current_fn.append(line)
            if any(k in line for k in DANGER_KEYWORDS):
                fn_is_dangerous = True
            if stripped == "}":
                if fn_is_dangerous:
                    selected.extend(current_fn)
                current_fn = []
                in_fn = False
                fn_is_dangerous = False
        else:
            # Always include top-level declarations (state vars, imports, mappings)
            if any(stripped.startswith(kw) for kw in (
                "pragma", "import", "contract ", "mapping", "address ", "bool ",
                "uint", "event ", "modifier ", "error "
            )):
                selected.append(line)

    snippet = "\n".join(selected)
    if len(snippet) > max_chars:
        snippet = snippet[:max_chars] + "\n... [truncated]"
    return snippet
