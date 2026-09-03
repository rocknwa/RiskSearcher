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

import os
from dataclasses import dataclass, asdict

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


def analyze(address: str, ticket_meta: dict = None, chain: str | None = "ethereum") -> AnalysisResult:
    """Full analysis pipeline for a single contract address."""

    print("[1/5] Fetching contract source...")
    src = get_source_code(address, chain=chain)
    source_verified = src["verified"]
    source_code = src["source_code"]
    contract_name = src.get("contract_name", "")

    if source_verified:
        print(f"    [SOURCE] Verified: {contract_name}")
    else:
        print(f"    [SOURCE] Unverified — bytecode only")

    print("[2/5] Running rule-based analysis...")
    rpc_ctx = get_contract_context(address, chain=chain)

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
        }
    else:
        specialist_context = {
            "mode": "bytecode",
            "contract_name": contract_name,
            "bytecode_findings": bytecode_rules,
            "behavioral": tx_analysis,
            "similar": similar,
        }

    balance_prompt = (
        f"You are a security auditor specializing in balance and access-control logic.\n"
        f"Context mode: {specialist_context['mode']}\n"
        f"Contract: {contract_name}\n\n"
    )
    if specialist_context["mode"] == "source":
        balance_prompt += "Provide a focused analysis of the source code, searching for overridden view functions, gated or conditional balance checks, and any transfer/sell logic that behaves differently depending on msg.sender. Include line references and a concise explanation of the mechanism.\n\n"
        balance_prompt += "SOURCE_FILES:\n"
        for name, content in (specialist_context.get("source_files") or {}).items():
            balance_prompt += f"-- {name} --\n{content.get('content','')}\n\n"
    else:
        balance_prompt += "You have only bytecode-derived findings and behavioral traces. Based on selectors/opcodes and transfer history, explain whether a balance or visibility check could be present that gates behavior by caller. Cite the bytecode evidence.\n\n"
        balance_prompt += "BYTECODE_FINDINGS:\n"
        balance_prompt += str(specialist_context.get("bytecode_findings") or {})[:4000]

    balance_prompt += "\nBEHAVIORAL_SUMMARY:\n"
    balance_prompt += tx_analysis.get("summary", "")[:2000]

    print("[3/5] Running specialist analysis...")
    try:
        specialist_result = run_specialist("balance_access", balance_prompt)
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
        print("    [LLM] Specialist: returned usable response")
    else:
        print("    [LLM] Specialist: no usable response; continuing with rule-based verdict")

    # Explicit verdict branch: specialist success -> judge pass; otherwise pure rule fallback
    judge_result = {"verdict": "", "severity": "", "reason": "", "error": "", "backend": "none"}
    if specialist_success:
        print("[4/5] Running judge pass...")
        try:
            judge_result = run_judge(
                rule_findings=scoring,
                specialist_findings=specialist_result.get("response", ""),
                address=address,
                chain=chain or "ethereum",
                provider=specialist_result.get("provider"),
                model=specialist_result.get("model"),
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
            print("    [LLM] Judge: returned final verdict/severity/reason")
        else:
            final_verdict = scoring["verdict"]
            final_severity = scoring["severity"]
            final_reason = "Rule-based verdict retained after judge failure"
            final_score = rule_score
            score_source = "rule_based"
            verdict_source = "rule_based"
            judge_error = judge_result.get("error") or "judge returned an invalid or empty response"
            print(f"    [LLM] Judge: failed ({judge_error}); retaining rule-based verdict")
    else:
        final_verdict = scoring["verdict"]
        final_severity = scoring["severity"]
        final_reason = (scoring["breakdown"][0] if scoring.get("breakdown") else "No risk signals detected")
        final_score = rule_score
        score_source = "rule_based"
        verdict_source = "rule_based"
        judge_error = "no real specialist response reached the judge"

    print("[5/5] Generating report...")
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
        specialist_findings=[{"id": "balance_access", "result": specialist_result}],
        comment=final_reason,
        judge_error=judge_result.get("error", "") if specialist_success else judge_error,
        final_reason=final_reason,
        rule_score=rule_score,
        score_source=score_source,
        verdict_source=verdict_source,
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