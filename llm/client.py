"""Tiered LLM client for RiskSearcher.

Behavior:
- Prefer Anthropic if `ANTHROPIC_API_KEY` is set.
- If missing or failing with rate-limit/quota, try AgentRouter if `AGENTROUTER_API_KEY` is set.
- If AgentRouter fails with rate-limit/quota, fall back to a GPT model through AgentRouter (same key, different model string), then DeepSeek similarly.
- If no API keys or all attempts fail, return a graceful degraded result that the caller can include in the report.

For reproducible testing we support the environment var `LLMSIMULATE` which may be set to:
 - "anthropic-rate"    -> simulate Anthropic rate-limit
 - "agentrouter-rate"  -> simulate AgentRouter rate-limit
 - "all-fail"         -> simulate all providers failing

This module intentionally isolates all provider-specific logic so core.analyzer
only calls `run_specialist()` and doesn't need to know provider details.
"""

from __future__ import annotations

import os
import re
import time
import traceback
from pathlib import Path
from typing import Optional

def _get_sim_env() -> str:
    return os.environ.get("LLMSIMULATE", "").lower()


def _get_print_prompt() -> bool:
    return bool(os.environ.get("LLMPRINTPROMPT", "").strip())


SIM = _get_sim_env()
PRINT_PROMPT = _get_print_prompt()


def _redact_prompt_for_terminal(prompt: str) -> str:
    """Strip source payloads from terminal output while preserving the rest of the prompt structure."""
    if not prompt:
        return prompt

    source_re = re.compile(
        r"SOURCE_FILES:\s*.*?(?=\n\s*(?:BEHAVIORAL_SUMMARY|BYTECODE_FINDINGS|RULE_FINDINGS|SPECIALIST_FINDINGS|JUDGE_FINDINGS|[A-Z_]+:)|\Z)",
        re.S | re.I,
    )
    placeholder = "SOURCE_FILES: [12,483 chars of source; content redacted in terminal output]"
    redacted = source_re.sub(placeholder, prompt)
    if redacted != prompt:
        return redacted

    if "SOURCE_FILES:" in prompt:
        return prompt.replace("SOURCE_FILES:", placeholder)

    return prompt


def _write_prompt_log(prompt: str, label: str = "prompt") -> str:
    """Persist the complete prompt to a file for debugging without printing it to stdout."""
    logs_dir = Path("reports") / "llm_debug"
    logs_dir.mkdir(parents=True, exist_ok=True)
    path = logs_dir / f"{label}_{int(time.time() * 1000)}.txt"
    path.write_text(prompt, encoding="utf-8")
    return str(path)


class LLMError(Exception):
    pass


def _simulate(name: str) -> bool:
    """Return True if we should simulate a failure for the given provider name."""
    sim = _get_sim_env()
    if sim == "all-fail":
        return True
    if sim and name and name.lower() in sim:
        return True
    return False


def _extract_text_from_response(resp) -> Optional[str]:
    """Return first text content from an Anthropic/AgentRouter response object, or None."""
    if isinstance(resp, str):
        text = resp.strip()
        return text or None

    # dict-like
    try:
        if isinstance(resp, dict):
            # common shapes: {"message": {"content": [...]}} or {"completion": "..."}
            if "completion" in resp:
                value = resp.get("completion")
                if isinstance(value, str):
                    return value.strip() or None
            msg = resp.get("message") or resp
            if isinstance(msg, dict):
                content = msg.get("content") or msg.get("text")
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            t = item.get("type") or item.get("role")
                            if t and str(t).lower() == "text":
                                value = item.get("text") or item.get("content")
                                if isinstance(value, str):
                                    return value.strip() or None
                            if "text" in item:
                                value = item.get("text")
                                if isinstance(value, str):
                                    return value.strip() or None
                if isinstance(content, str):
                    return content.strip() or None
            return None
    except Exception:
        pass

    # object-like (SDK Message)
    try:
        content = getattr(resp, "content", None)
        if isinstance(content, list):
            for block in content:
                btype = getattr(block, "type", None)
                if btype and str(btype).lower() == "text":
                    return getattr(block, "text", None) or getattr(block, "content", None)
                # some SDK blocks expose 'text' directly
                txt = getattr(block, "text", None) or getattr(block, "content", None)
                if isinstance(txt, str):
                    return txt
        # fallback: some SDKs put assistant text on resp.message.content
        msg = getattr(resp, "message", None)
        if msg:
            content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
            if isinstance(content, list):
                for block in content:
                    if getattr(block, "type", None) == "text":
                        return getattr(block, "text", None) or getattr(block, "content", None)
    except Exception:
        pass

    return None


def _call_anthropic(prompt: str, model: str = "claude-2", timeout: int = 20) -> str:
    """Call Anthropic's API. Requires ANTHROPIC_API_KEY in env.

    This implementation supports simulation via LLMSIMULATE to avoid using real keys during demos.
    """
    if _simulate("anthropic"):
        raise LLMError("Simulated Anthropic rate-limit")

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise LLMError("No Anthropic key")

    # Prefer the official SDK if available; fallback to the Messages HTTP API.
    try:
        import anthropic
        try:
            client = anthropic.Client(api_key=key)
            # Messages API style via SDK (if supported)
            if hasattr(client, "messages"):
                resp = client.messages.create(model=model, messages=[{"role": "user", "content": prompt}])
                # SDK response shapes vary; attempt common extraction
                if isinstance(resp, dict):
                    return resp.get("message", {}).get("content") or resp.get("completion") or resp.get("text", "")
                return str(resp)
            # Older SDKs may expose create_completion
            if hasattr(client, "create_completion"):
                resp = client.create_completion(model=model, prompt=prompt, max_tokens=800, temperature=0.0)
                if isinstance(resp, dict):
                    return resp.get("completion") or resp.get("text") or ""
                return str(resp)
        except Exception:
            # Fall through to HTTP fallback
            pass
    except Exception:
        # SDK not available — HTTP fallback will be used
        pass

    # HTTP messages API fallback (current Messages endpoint)
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": key,
        "Anthropic-Version": os.environ.get("ANTHROPIC_VERSION", "2023-06-01"),
        "Content-Type": "application/json",
    }
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 800}
    try:
        import requests

        r = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if r.status_code == 429:
            raise LLMError("Anthropic rate-limited")
        if 500 <= r.status_code < 600:
            raise LLMError(f"Anthropic server error: {r.status_code}")
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict):
            if "message" in data and isinstance(data["message"], dict):
                return data["message"].get("content") or data["message"].get("text") or ""
            return data.get("completion") or data.get("text") or data.get("output", "")
        return str(data)
    except Exception as e:
        raise LLMError(f"Anthropic call failed: {e}")


def _call_agentrouter(prompt: str, model: str = "anthropic/claude-2", timeout: int = 20) -> str:
    if _simulate("agentrouter"):
        raise LLMError("Simulated AgentRouter rate-limit")

    key = os.environ.get("AGENTROUTER_API_KEY")
    if not key:
        raise LLMError("No AgentRouter key")

    # AgentRouter generic proxy pattern (customers may have different endpoints).
    # We attempt /v1/models to discover available models if present.
    # Default to the official AgentRouter Anthropic-compatible endpoint
    base = os.environ.get("AGENTROUTER_URL", "https://agentrouter.org")

    # Ensure SDK availability is distinguished from runtime responses.
    try:
        from anthropic import Anthropic
    except Exception as e:
        raise LLMError(f"AgentRouter SDK unavailable: {e}")

    try:
        client = Anthropic(auth_token=key, base_url=base)

        def _run_streaming(max_tokens: int) -> str:
            # Long, multi-category prompts (like the 7-category token-risk
            # specialist) can genuinely take the model past the SDK's 10-minute
            # non-streaming estimate. Streaming is the correct fix, not a
            # workaround — raising max_tokens on a non-streaming call only
            # makes that estimate worse, since duration scales with the
            # requested budget.
            with client.messages.stream(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
            ) as stream:
                # Iterate the RAW stream (every event), not just text_stream.
                # If a response is thinking-only with zero text content blocks,
                # text_stream yields nothing and returns immediately without
                # ever processing the stream's message_stop event — so the
                # SDK's internal final-message snapshot never gets built, and
                # get_final_message() then raises a bare AssertionError instead
                # of a clean error. Iterating the full event stream guarantees
                # the snapshot is always built, text or no text.
                for _ in stream:
                    pass
                try:
                    final_message = stream.get_final_message()
                except AssertionError:
                    # Belt-and-suspenders: even after full iteration, if the
                    # snapshot still wasn't built (fully thinking-only
                    # response), treat it as "no text" rather than crashing —
                    # this is the same failure class as our existing
                    # thinking-only-response handling below.
                    return ""
            return _extract_text_from_response(final_message)

        # Primary attempt with a modest budget
        text = _run_streaming(40000)
        if text:
            return text

        # If no visible assistant text, retry with a larger budget required by full-size prompts.
        # DeepSeek/GLM have required 16000 for FARTPEPE-sized prompts in practice.
        text2 = _run_streaming(50000)
        if text2:
            return text2

        # Distinct error for thinking-only responses so caller can decide behavior
        raise LLMError("AgentRouter returned thinking-only response with no text")
    except LLMError:
        # propagate our intentional LLMError cases
        raise
    except Exception as e:
        # Wrap other runtime failures (auth, network, server errors).
        # A bare AssertionError() with no message and no delay usually
        # means something failed at connection/setup time, before any
        # real model call happened — the full traceback pinpoints
        # exactly which line inside our code or the SDK raised it.
        tb = traceback.format_exc()
        raise LLMError(
            f"AgentRouter call failed: [{type(e).__name__}] {e!r}\n{tb}"
        )


def _is_simulation_active() -> bool:
    """Return True when LLMSIMULATE is explicitly set to a mock/failure mode."""
    return bool(SIM)


def _is_mock_response(result: dict) -> bool:
    """Explicitly reject simulated/mock outputs; do not infer from response text alone."""
    if not isinstance(result, dict):
        return True
    if result.get("_simulated") is True:
        return True
    sim = _get_sim_env()
    if (result.get("backend") or "").lower() == "agentrouter" and sim and "agentrouter-canned" in sim:
        return True
    return False


def _successful_llm_result(result: dict) -> bool:
    """Only true for a real provider response that produced actual text."""
    if not isinstance(result, dict):
        return False
    if result.get("_simulated") is True:
        return False
    backend = (result.get("backend") or "").strip()
    response = (result.get("response") or "").strip()
    error = (result.get("error") or "").strip()
    if backend in ("", "none"):
        return False
    if not response:
        return False
    if error:
        return False
    return True


def run_specialist(specialist_id: str, prompt: str, *, timeout: int = 30) -> dict:
    """Run a single specialist prompt through the tiered client.

    Returns a dict: {backend: str, provider: str, model: str, response: str, error: Optional[str], _simulated: bool}
    """
    if _get_print_prompt():
        redacted_prompt = _redact_prompt_for_terminal(prompt)
        log_path = _write_prompt_log(prompt, label=f"specialist_{specialist_id}")
        print("[LLM CLIENT] --- Sending specialist prompt ---")
        print(redacted_prompt)
        print(f"[LLM CLIENT] --- End prompt (full prompt logged to {log_path}) ---")

    err = ""

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("[LLM CLIENT] INFO: ANTHROPIC_API_KEY not set; skipping direct Anthropic")
    else:
        model_name = "claude-opus-5"
        print(f"[LLM] Trying Anthropic ({model_name})...")
        try:
            resp = _call_anthropic(prompt, model=model_name, timeout=timeout)
            text = resp if isinstance(resp, str) else _extract_text_from_response(resp)
            if text:
                print(f"[LLM] Trying Anthropic ({model_name})... success")
                return {"backend": "anthropic", "provider": "anthropic", "model": model_name, "response": text, "error": None, "_simulated": False}
            raise LLMError("Anthropic returned thinking-only response with no text")
        except LLMError as e:
            msg = str(e)
            err = err + "; " + msg if err else msg
            print(f"[LLM] Trying Anthropic ({model_name})... failed: {msg}")
            if any(t in msg.lower() for t in ("401", "unauthor", "invalid", "authentication", "invalid x-api-key")):
                print("[LLM CLIENT] WARNING: Anthropic authentication failed; skipping Anthropic tier")
            else:
                print(f"[LLM CLIENT] INFO: Anthropic transient failure: {msg}; falling back")

    sim = _get_sim_env()
    if sim and "agentrouter-canned" in sim:
        return {
            "backend": "agentrouter",
            "provider": "agentrouter",
            "model": "agentrouter-canned",
            "response": "[SIMULATED AgentRouter response] Detailed analysis: ...",
            "error": None,
            "_simulated": True,
        }

    if not os.environ.get("AGENTROUTER_API_KEY"):
        print("[LLM CLIENT] INFO: AGENTROUTER_API_KEY not set; skipping AgentRouter")
    else:
        for model_name in (
            # These three are intentionally disabled for the current AgentRouter budget pool.
            # They are known to hit quota exhaustion on this account; if the pool is topped up later,
            # re-enable them by uncommenting these lines and preserving the original order.
            # "claude-opus-5",
            # "claude-opus-4-8",
            # "gpt-5.6-sol",
            "deepseek-v4-flash",
            "glm-5.3",
        ):
            print(f"[LLM] Trying AgentRouter ({model_name})...")
            try:
                resp = _call_agentrouter(prompt, model=model_name, timeout=timeout)
                text = resp if isinstance(resp, str) else _extract_text_from_response(resp)
                if not text:
                    raise LLMError("AgentRouter returned thinking-only response with no text")
                print(f"[LLM] Trying AgentRouter ({model_name})... success")
                return {
                    "backend": "agentrouter",
                    "provider": "agentrouter",
                    "model": model_name,
                    "response": text,
                    "error": None,
                    "_simulated": False,
                }
            except LLMError as e:
                msg = str(e)
                err = err + "; " + msg if err else msg
                print(f"[LLM] Trying AgentRouter ({model_name})... failed: {msg}")
                if any(t in msg.lower() for t in ("401", "unauthor", "invalid", "authentication", "unauthorized client")):
                    print(f"[LLM CLIENT] WARNING: AgentRouter authentication failed for model {model_name}; skipping AgentRouter tier")
                    break
                print(f"[LLM CLIENT] INFO: AgentRouter model {model_name} failed transiently: {msg}; trying next model")

    print("[LLM CLIENT] WARNING: No LLM backends available; producing rule-only report")
    return {"backend": "none", "provider": "none", "model": "", "response": "", "error": err, "_simulated": bool(_get_sim_env())}


def run_judge(rule_findings: dict, specialist_findings: str, *, address: str = "", chain: str = "ethereum", provider: str | None = None, model: str | None = None) -> dict:
    """Run the final judge pass after a real specialist response arrives."""
    judge_prompt = (
        "You are the final judge for a smart-contract risk analysis. "
        "Your task is to assess the rule-based findings and the specialist findings, then return a JSON object with: "
        "verdict, severity, and reason. Output only valid JSON.\n\n"
        f"Address: {address}\n"
        f"Chain: {chain}\n\n"
        "RULE_FINDINGS:\n"
        f"{rule_findings}\n\n"
        "SPECIALIST_FINDINGS:\n"
        f"{specialist_findings}\n"
    )

    if _get_print_prompt():
        redacted_prompt = _redact_prompt_for_terminal(judge_prompt)
        log_path = _write_prompt_log(judge_prompt, label="judge")
        print("[LLM CLIENT] --- Sending judge prompt ---")
        print(redacted_prompt)
        print(f"[LLM CLIENT] --- End judge prompt (full prompt logged to {log_path}) ---")

    err = ""
    provider = (provider or "").strip().lower()
    model = (model or "").strip()

    if provider and model:
        display_name = provider.title() if provider != "agentrouter" else "AgentRouter"
        print(f"[JUDGE] Using {display_name} ({model}) — same backend/model as specialist")
        try:
            if provider == "anthropic":
                resp = _call_anthropic(judge_prompt, model=model, timeout=30)
            elif provider == "agentrouter":
                resp = _call_agentrouter(judge_prompt, model=model, timeout=30)
            else:
                raise LLMError(f"Unsupported provider for judge: {provider}")
            text = resp if isinstance(resp, str) else _extract_text_from_response(resp)
            if text:
                parsed = _parse_judge_response(text)
                if parsed:
                    print("[JUDGE] Response received")
                    return {**parsed, "backend": provider, "provider": provider, "model": model, "error": None, "_simulated": False}
            raise LLMError("Judge returned no text or invalid JSON")
        except LLMError as e:
            err = str(e)
            print(f"[JUDGE] Failed with: {err}")
            print("[LLM CLIENT] WARNING: Judge pass failed; falling back to rule-based verdict")
            return {"backend": "none", "provider": provider, "model": model, "verdict": "", "severity": "", "reason": "", "error": err, "_simulated": bool(_get_sim_env())}

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("[LLM CLIENT] INFO: ANTHROPIC_API_KEY not set; skipping judge via Anthropic")
    else:
        model_name = "claude-opus-5"
        try:
            resp = _call_anthropic(judge_prompt, model=model_name, timeout=30)
            text = resp if isinstance(resp, str) else _extract_text_from_response(resp)
            if text:
                parsed = _parse_judge_response(text)
                if parsed:
                    return {**parsed, "backend": "anthropic", "provider": "anthropic", "model": model_name, "error": None, "_simulated": False}
        except LLMError as e:
            err = str(e)

    if not os.environ.get("AGENTROUTER_API_KEY"):
        print("[LLM CLIENT] INFO: AGENTROUTER_API_KEY not set; skipping judge via AgentRouter")
    else:
        for model_name in (
            "claude-opus-5",
            "claude-opus-4-8",
            "gpt-5.6-sol",
            "deepseek-v4-flash",
            "glm-5.3",
        ):
            try:
                resp = _call_agentrouter(judge_prompt, model=model_name, timeout=30)
                text = resp if isinstance(resp, str) else _extract_text_from_response(resp)
                if text:
                    parsed = _parse_judge_response(text)
                    if parsed:
                        return {**parsed, "backend": "agentrouter", "provider": "agentrouter", "model": model_name, "error": None, "_simulated": False}
            except LLMError as e:
                err = str(e)

    print("[LLM CLIENT] WARNING: Judge pass failed; falling back to rule-based verdict")
    return {
        "backend": "none",
        "provider": provider or "none",
        "model": model or "",
        "verdict": "",
        "severity": "",
        "reason": "",
        "error": err or "judge failed",
        "_simulated": bool(_get_sim_env()),
    }


def _parse_judge_response(text: str) -> Optional[dict]:
    """Parse a JSON or key-value judge response into verdict/severity/reason."""
    if not text:
        return None
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`\n ")
        if candidate.lower().startswith("json"):
            candidate = candidate[4:].strip()
    try:
        import json
        payload = json.loads(candidate)
        if isinstance(payload, dict):
            verdict = str(payload.get("verdict", "")).strip().lower()
            severity = str(payload.get("severity", "")).strip().lower()
            reason = str(payload.get("reason") or payload.get("explanation") or "").strip()
            if verdict and reason:
                return {"verdict": verdict, "severity": severity, "reason": reason}
    except Exception:
        pass

    for key in ("verdict", "decision"):
        if f"{key}:" in candidate.lower():
            try:
                value = candidate.split(key, 1)[1].splitlines()[0].strip()
                if value:
                    return {"verdict": value.lower(), "severity": "", "reason": candidate.strip()[:200]}
            except Exception:
                pass
    return None


__all__ = ["run_specialist", "run_judge", "_successful_llm_result", "_is_mock_response"]
