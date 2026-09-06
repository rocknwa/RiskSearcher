"""
Tiered LLM client for RiskSearcher.

Provider routing:
- Direct Anthropic -> Anthropic Messages API when ANTHROPIC_API_KEY is set.
- AgentRouter Claude models -> AgentRouter Anthropic-compatible API.
- AgentRouter DeepSeek / GLM / GPT models -> AgentRouter OpenAI-compatible
  Chat Completions API.
- If all LLM attempts fail, return a graceful rule-only result.

This module isolates provider-specific logic from core.analyzer.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Optional


def _get_sim_env() -> str:
    return os.environ.get("LLMSIMULATE", "").lower()


def _get_print_prompt() -> bool:
    return bool(os.environ.get("LLMPRINTPROMPT", "").strip())


SIM = _get_sim_env()
PRINT_PROMPT = _get_print_prompt()


def _redact_prompt_for_terminal(prompt: str) -> str:
    """Strip source payloads from terminal output while preserving structure."""
    if not prompt:
        return prompt

    source_re = re.compile(
        r"SOURCE_FILES:\s*.*?(?=\n\s*(?:BEHAVIORAL_SUMMARY|BYTECODE_FINDINGS|"
        r"RULE_FINDINGS|SPECIALIST_FINDINGS|JUDGE_FINDINGS|[A-Z_]+:)|\Z)",
        re.S | re.I,
    )
    placeholder = (
        "SOURCE_FILES: [source content redacted in terminal output]"
    )
    redacted = source_re.sub(placeholder, prompt)

    if redacted != prompt:
        return redacted

    if "SOURCE_FILES:" in prompt:
        return prompt.replace("SOURCE_FILES:", placeholder)

    return prompt


def _write_prompt_log(prompt: str, label: str = "prompt") -> str:
    """Persist the complete prompt to a local debug file."""
    logs_dir = Path("reports") / "llm_debug"
    logs_dir.mkdir(parents=True, exist_ok=True)
    path = logs_dir / f"{label}_{int(time.time() * 1000)}.txt"
    path.write_text(prompt, encoding="utf-8")
    return str(path)


class LLMError(Exception):
    pass


def _simulate(name: str) -> bool:
    """Return True when the requested provider failure is simulated."""
    sim = _get_sim_env()

    if sim == "all-fail":
        return True

    if sim and name and name.lower() in sim:
        return True

    return False


def _extract_text_from_response(resp) -> Optional[str]:
    """Extract visible text from common provider response shapes."""
    if isinstance(resp, str):
        text = resp.strip()
        return text or None

    # Dict-like responses.
    try:
        if isinstance(resp, dict):
            if "completion" in resp:
                value = resp.get("completion")
                if isinstance(value, str):
                    return value.strip() or None

            # OpenAI Chat Completions.
            choices = resp.get("choices")
            if isinstance(choices, list) and choices:
                choice = choices[0]

                if isinstance(choice, dict):
                    message = choice.get("message")

                    if isinstance(message, dict):
                        content = message.get("content")

                        if isinstance(content, str):
                            return content.strip() or None

                        if isinstance(content, list):
                            for item in content:
                                if isinstance(item, dict):
                                    value = item.get("text")
                                    if isinstance(value, str) and value.strip():
                                        return value.strip()

                    value = choice.get("text")
                    if isinstance(value, str):
                        return value.strip() or None

            msg = resp.get("message") or resp

            if isinstance(msg, dict):
                content = msg.get("content") or msg.get("text")

                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict):
                            item_type = item.get("type")

                            if (
                                item_type
                                and str(item_type).lower() == "text"
                            ):
                                value = (
                                    item.get("text")
                                    or item.get("content")
                                )
                                if isinstance(value, str):
                                    return value.strip() or None

                            value = item.get("text")
                            if isinstance(value, str):
                                return value.strip() or None

                if isinstance(content, str):
                    return content.strip() or None

            return None

    except Exception:
        pass

    # Object-like SDK responses.
    try:
        content = getattr(resp, "content", None)

        if isinstance(content, list):
            for block in content:
                block_type = getattr(block, "type", None)

                if (
                    block_type
                    and str(block_type).lower() == "text"
                ):
                    value = (
                        getattr(block, "text", None)
                        or getattr(block, "content", None)
                    )
                    if isinstance(value, str):
                        return value.strip() or None

                value = (
                    getattr(block, "text", None)
                    or getattr(block, "content", None)
                )
                if isinstance(value, str):
                    return value.strip() or None

        msg = getattr(resp, "message", None)

        if msg:
            msg_content = getattr(msg, "content", None)

            if msg_content is None and isinstance(msg, dict):
                msg_content = msg.get("content")

            if isinstance(msg_content, list):
                for block in msg_content:
                    if getattr(block, "type", None) == "text":
                        value = (
                            getattr(block, "text", None)
                            or getattr(block, "content", None)
                        )
                        if isinstance(value, str):
                            return value.strip() or None

    except Exception:
        pass

    return None


def _call_anthropic(
    prompt: str,
    model: str = "claude-opus-5",
    timeout: int = 300,
) -> str:
    """Call Anthropic's official Messages API."""

    if _simulate("anthropic"):
        raise LLMError("Simulated Anthropic rate-limit")

    key = os.environ.get("ANTHROPIC_API_KEY")

    if not key:
        raise LLMError("No Anthropic key")

    import requests

    url = "https://api.anthropic.com/v1/messages"

    headers = {
        "x-api-key": key,
        "anthropic-version": os.environ.get(
            "ANTHROPIC_VERSION",
            "2023-06-01",
        ),
        "content-type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "max_tokens": 40000,
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=timeout,
        )

        if response.status_code == 429:
            raise LLMError("Anthropic rate-limited")

        if response.status_code in (401, 403):
            raise LLMError(
                f"Anthropic authentication failed: "
                f"HTTP {response.status_code}: "
                f"{response.text[:500]}"
            )

        if response.status_code >= 500:
            raise LLMError(
                f"Anthropic server error: "
                f"HTTP {response.status_code}"
            )

        response.raise_for_status()

        data = response.json()
        text = _extract_text_from_response(data)

        if text:
            return text

        raise LLMError(
            "Anthropic returned no visible text"
        )

    except LLMError:
        raise
    except requests.Timeout:
        raise LLMError(
            f"Anthropic request timed out after {timeout}s"
        )
    except requests.RequestException as exc:
        raise LLMError(
            f"Anthropic HTTP failure: "
            f"[{type(exc).__name__}] {exc}"
        )
    except Exception as exc:
        raise LLMError(
            f"Anthropic response parsing failed: "
            f"[{type(exc).__name__}] {exc!r}"
        )


def _call_agentrouter(
    prompt: str,
    model: str = "deepseek-v4-flash",
    timeout: int = 600,
) -> str:
    """
    Call AgentRouter using the correct protocol.

    Claude:
        AgentRouter Anthropic-compatible Messages API.

    DeepSeek / GLM / GPT:
        AgentRouter OpenAI-compatible Chat Completions API.

    Direct requests are used instead of the Anthropic SDK for AgentRouter
    to avoid protocol/SDK mismatches.
    """

    if _simulate("agentrouter"):
        raise LLMError("Simulated AgentRouter rate-limit")

    key = os.environ.get("AGENTROUTER_API_KEY")

    if not key:
        raise LLMError("No AgentRouter key")

    import requests

    model_lower = model.lower().strip()

    # ================================================================
    # CLAUDE -> AGENTROUTER ANTHROPIC-COMPATIBLE API
    # ================================================================
    if model_lower.startswith("claude"):
        base = os.environ.get(
            "AGENTROUTER_ANTHROPIC_URL",
            "https://co.agentrouter.org",
        ).rstrip("/")

        url = f"{base}/v1/messages"

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "max_tokens": 40000,
        }

        print(
            f"    [LLM CLIENT] AgentRouter Anthropic request: "
            f"model={model}, prompt={len(prompt)} chars"
        )

        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

            if response.status_code == 429:
                raise LLMError(
                    "AgentRouter Anthropic rate-limited"
                )

            if response.status_code in (401, 403):
                raise LLMError(
                    f"AgentRouter Anthropic authentication failed: "
                    f"HTTP {response.status_code}: "
                    f"{response.text[:500]}"
                )

            if response.status_code >= 500:
                raise LLMError(
                    f"AgentRouter Anthropic server error: "
                    f"HTTP {response.status_code}"
                )

            response.raise_for_status()

            data = response.json()
            text = _extract_text_from_response(data)

            if text:
                return text

            raise LLMError(
                "AgentRouter Anthropic returned no visible text"
            )

        except LLMError:
            raise
        except requests.Timeout:
            raise LLMError(
                f"AgentRouter Anthropic request timed out "
                f"after {timeout}s"
            )
        except requests.RequestException as exc:
            raise LLMError(
                f"AgentRouter Anthropic HTTP failure: "
                f"[{type(exc).__name__}] {exc}"
            )
        except Exception as exc:
            raise LLMError(
                f"AgentRouter Anthropic response parsing failed: "
                f"[{type(exc).__name__}] {exc!r}"
            )

    # ================================================================
    # DEEPSEEK / GLM / GPT -> OPENAI-COMPATIBLE API
    # ================================================================
    base = os.environ.get(
        "AGENTROUTER_OPENAI_URL",
        "https://co.agentrouter.org/v1",
    ).rstrip("/")

    url = f"{base}/chat/completions"

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    prompt_len = len(prompt)

    print(
        f"    [LLM CLIENT] AgentRouter OpenAI-compatible request: "
        f"model={model}, prompt={prompt_len} chars "
        f"(~{prompt_len // 4} tokens est.)"
    )

    def _request(max_tokens: int) -> str:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "max_tokens": max_tokens,
            "temperature": 0,
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

            if response.status_code == 429:
                raise LLMError(
                    "AgentRouter OpenAI-compatible rate-limited"
                )

            if response.status_code in (401, 403):
                raise LLMError(
                    f"AgentRouter authentication failed: "
                    f"HTTP {response.status_code}: "
                    f"{response.text[:500]}"
                )

            if response.status_code == 404:
                raise LLMError(
                    f"AgentRouter endpoint/model not found: "
                    f"HTTP 404: {response.text[:1000]}"
                )

            if response.status_code >= 500:
                raise LLMError(
                    f"AgentRouter server error: "
                    f"HTTP {response.status_code}: "
                    f"{response.text[:500]}"
                )

            response.raise_for_status()

            data = response.json()
            text = _extract_text_from_response(data)

            if text:
                return text

            print(
                "    [LLM CLIENT] AgentRouter returned no visible text."
            )
            print(
                "    [LLM CLIENT] Response preview: "
                f"{json.dumps(data, ensure_ascii=False)[:1500]}"
            )

            return ""

        except LLMError:
            raise
        except requests.Timeout:
            raise LLMError(
                f"AgentRouter request timed out after {timeout}s"
            )
        except requests.RequestException as exc:
            raise LLMError(
                f"AgentRouter HTTP failure: "
                f"[{type(exc).__name__}] {exc}"
            )
        except Exception as exc:
            raise LLMError(
                f"AgentRouter response parsing failed: "
                f"[{type(exc).__name__}] {exc!r}"
            )

    # First attempt.
    text = _request(40000)

    if text:
        return text

    # Retry only after a genuine empty response.
    print(
        f"    [LLM CLIENT] AgentRouter returned empty visible text "
        f"for {prompt_len}-char prompt; retrying with 80000 tokens"
    )

    text = _request(80000)

    if text:
        return text

    raise LLMError(
        f"AgentRouter returned no visible text "
        f"(model={model}, prompt={prompt_len} chars)"
    )


def _is_simulation_active() -> bool:
    return bool(_get_sim_env())


def _is_mock_response(result: dict) -> bool:
    """Reject simulated/mock outputs."""
    if not isinstance(result, dict):
        return True

    if result.get("_simulated") is True:
        return True

    sim = _get_sim_env()

    if (
        result.get("backend") or ""
    ).lower() == "agentrouter" and sim:
        if "agentrouter-canned" in sim:
            return True

    return False


def _successful_llm_result(result: dict) -> bool:
    """True only for a real provider response containing text."""
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


def run_specialist(
    specialist_id: str,
    prompt: str,
    *,
    timeout: int = 600,
) -> dict:
    """
    Run a specialist prompt through the tiered client.

    Returns:
        {
            backend: str,
            provider: str,
            model: str,
            response: str,
            error: Optional[str],
            _simulated: bool,
        }
    """

    if _get_print_prompt():
        redacted_prompt = _redact_prompt_for_terminal(prompt)
        log_path = _write_prompt_log(
            prompt,
            label=f"specialist_{specialist_id}",
        )

        print("[LLM CLIENT] --- Sending specialist prompt ---")
        print(redacted_prompt)
        print(
            "[LLM CLIENT] --- End prompt "
            f"(full prompt logged to {log_path}) ---"
        )

    err = ""

    # ================================================================
    # DIRECT ANTHROPIC
    # ================================================================
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "[LLM CLIENT] INFO: ANTHROPIC_API_KEY not set; "
            "skipping direct Anthropic"
        )
    else:
        model_name = "claude-opus-5"

        print(
            f"[LLM] Trying Anthropic ({model_name})..."
        )

        try:
            text = _call_anthropic(
                prompt,
                model=model_name,
                timeout=timeout,
            )

            if text:
                print(
                    f"[LLM] Trying Anthropic ({model_name})... success"
                )

                return {
                    "backend": "anthropic",
                    "provider": "anthropic",
                    "model": model_name,
                    "response": text,
                    "error": None,
                    "_simulated": False,
                }

            raise LLMError(
                "Anthropic returned no visible text"
            )

        except LLMError as exc:
            msg = str(exc)
            err = f"{err}; {msg}" if err else msg

            print(
                f"[LLM] Trying Anthropic ({model_name})... "
                f"failed: {msg}"
            )

            if any(
                token in msg.lower()
                for token in (
                    "401",
                    "unauthor",
                    "invalid",
                    "authentication",
                    "invalid x-api-key",
                )
            ):
                print(
                    "[LLM CLIENT] WARNING: Anthropic authentication "
                    "failed; skipping Anthropic tier"
                )
            else:
                print(
                    f"[LLM CLIENT] INFO: Anthropic transient failure: "
                    f"{msg}; falling back"
                )

    # ================================================================
    # SIMULATED AGENTROUTER
    # ================================================================
    sim = _get_sim_env()

    if sim and "agentrouter-canned" in sim:
        return {
            "backend": "agentrouter",
            "provider": "agentrouter",
            "model": "agentrouter-canned",
            "response": (
                "[SIMULATED AgentRouter response] "
                "Detailed analysis: ..."
            ),
            "error": None,
            "_simulated": True,
        }

    # ================================================================
    # AGENTROUTER SPECIALIST MODELS
    # ================================================================
    if not os.environ.get("AGENTROUTER_API_KEY"):
        print(
            "[LLM CLIENT] INFO: AGENTROUTER_API_KEY not set; "
            "skipping AgentRouter"
        )
    else:
        for model_name in (
            "deepseek-v4-flash",
            "glm-5.3",
        ):
            print(
                f"[LLM] Trying AgentRouter ({model_name})..."
            )

            try:
                text = _call_agentrouter(
                    prompt,
                    model=model_name,
                    timeout=timeout,
                )

                if not text:
                    raise LLMError(
                        "AgentRouter returned no visible text"
                    )

                print(
                    f"[LLM] Trying AgentRouter ({model_name})... "
                    "success"
                )

                return {
                    "backend": "agentrouter",
                    "provider": "agentrouter",
                    "model": model_name,
                    "response": text,
                    "error": None,
                    "_simulated": False,
                }

            except LLMError as exc:
                msg = str(exc)
                err = f"{err}; {msg}" if err else msg

                print(
                    f"[LLM] Trying AgentRouter ({model_name})... "
                    f"failed: {msg}"
                )

                if any(
                    token in msg.lower()
                    for token in (
                        "401",
                        "unauthor",
                        "invalid",
                        "authentication",
                        "unauthorized client",
                    )
                ):
                    print(
                        "[LLM CLIENT] WARNING: AgentRouter "
                        f"authentication failed for model "
                        f"{model_name}; skipping AgentRouter tier"
                    )
                    break

                print(
                    "[LLM CLIENT] INFO: AgentRouter model "
                    f"{model_name} failed transiently: {msg}; "
                    "trying next model"
                )

    print(
        "[LLM CLIENT] WARNING: No LLM backends available; "
        "producing rule-only report"
    )

    return {
        "backend": "none",
        "provider": "none",
        "model": "",
        "response": "",
        "error": err,
        "_simulated": bool(_get_sim_env()),
    }


def run_judge(
    rule_findings: dict,
    specialist_findings: str,
    *,
    address: str = "",
    chain: str = "ethereum",
    provider: str | None = None,
    model: str | None = None,
) -> dict:
    """Run the final judge pass after a real specialist response."""

    judge_prompt = (
        "You are the final judge for a smart-contract risk analysis. "
        "Your task is to assess the rule-based findings and the "
        "specialist findings, then return a JSON object with: "
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
        log_path = _write_prompt_log(
            judge_prompt,
            label="judge",
        )

        print("[LLM CLIENT] --- Sending judge prompt ---")
        print(redacted_prompt)
        print(
            "[LLM CLIENT] --- End prompt "
            f"(full prompt logged to {log_path}) ---"
        )

    err = ""

    provider = (provider or "").strip().lower()
    model = (model or "").strip()

    # ================================================================
    # USE THE SAME REAL BACKEND/MODEL AS SPECIALIST
    # ================================================================
    if provider and model:
        display_name = (
            "AgentRouter"
            if provider == "agentrouter"
            else provider.title()
        )

        print(
            f"[JUDGE] Using {display_name} ({model}) — "
            "same backend/model as specialist"
        )

        try:
            if provider == "anthropic":
                text = _call_anthropic(
                    judge_prompt,
                    model=model,
                    timeout=300,
                )

            elif provider == "agentrouter":
                text = _call_agentrouter(
                    judge_prompt,
                    model=model,
                    timeout=300,
                )

            else:
                raise LLMError(
                    f"Unsupported provider for judge: {provider}"
                )

            if text:
                parsed = _parse_judge_response(text)

                if parsed:
                    print("[JUDGE] Response received")

                    return {
                        **parsed,
                        "backend": provider,
                        "provider": provider,
                        "model": model,
                        "error": None,
                        "_simulated": False,
                    }

            raise LLMError(
                "Judge returned no text or invalid JSON"
            )

        except LLMError as exc:
            err = str(exc)

            print(
                f"[JUDGE] Failed with: {err}"
            )
            print(
                "[LLM CLIENT] WARNING: Judge pass failed; "
                "falling back to rule-based verdict"
            )

            return {
                "backend": "none",
                "provider": provider,
                "model": model,
                "verdict": "",
                "severity": "",
                "reason": "",
                "error": err,
                "_simulated": bool(_get_sim_env()),
            }

    # ================================================================
    # FALLBACK JUDGE: DIRECT ANTHROPIC
    # ================================================================
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "[LLM CLIENT] INFO: ANTHROPIC_API_KEY not set; "
            "skipping judge via Anthropic"
        )
    else:
        model_name = "claude-opus-5"

        try:
            text = _call_anthropic(
                judge_prompt,
                model=model_name,
                timeout=300,
            )

            if text:
                parsed = _parse_judge_response(text)

                if parsed:
                    return {
                        **parsed,
                        "backend": "anthropic",
                        "provider": "anthropic",
                        "model": model_name,
                        "error": None,
                        "_simulated": False,
                    }

        except LLMError as exc:
            err = str(exc)

    # ================================================================
    # FALLBACK JUDGE: AGENTROUTER
    # ================================================================
    if not os.environ.get("AGENTROUTER_API_KEY"):
        print(
            "[LLM CLIENT] INFO: AGENTROUTER_API_KEY not set; "
            "skipping judge via AgentRouter"
        )
    else:
        for model_name in (
            "claude-opus-5",
            "claude-opus-4-8",
            "gpt-5.6-sol",
            "deepseek-v4-flash",
            "glm-5.3",
        ):
            try:
                text = _call_agentrouter(
                    judge_prompt,
                    model=model_name,
                    timeout=300,
                )

                if text:
                    parsed = _parse_judge_response(text)

                    if parsed:
                        return {
                            **parsed,
                            "backend": "agentrouter",
                            "provider": "agentrouter",
                            "model": model_name,
                            "error": None,
                            "_simulated": False,
                        }

            except LLMError as exc:
                err = str(exc)

    print(
        "[LLM CLIENT] WARNING: Judge pass failed; "
        "falling back to rule-based verdict"
    )

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
    """Parse JSON or key-value judge response."""

    if not text:
        return None

    candidate = text.strip()

    if candidate.startswith("```"):
        candidate = candidate.strip("`\n ")

        if candidate.lower().startswith("json"):
            candidate = candidate[4:].strip()

    try:
        payload = json.loads(candidate)

        if isinstance(payload, dict):
            verdict = str(
                payload.get("verdict", "")
            ).strip().lower()

            severity = str(
                payload.get("severity", "")
            ).strip().lower()

            reason = str(
                payload.get("reason")
                or payload.get("explanation")
                or ""
            ).strip()

            if verdict and reason:
                return {
                    "verdict": verdict,
                    "severity": severity,
                    "reason": reason,
                }

    except Exception:
        pass

    for key in ("verdict", "decision"):
        if f"{key}:" in candidate.lower():
            try:
                value = (
                    candidate
                    .split(key, 1)[1]
                    .splitlines()[0]
                    .strip()
                )

                if value:
                    return {
                        "verdict": value.lower(),
                        "severity": "",
                        "reason": candidate.strip()[:200],
                    }

            except Exception:
                pass

    return None


__all__ = [
    "run_specialist",
    "run_judge",
    "_successful_llm_result",
    "_is_mock_response",
]
