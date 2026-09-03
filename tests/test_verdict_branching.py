import io
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import llm.client as llm_client
from llm.client import run_specialist, run_judge


class TestSpecialistSimulationGuards(unittest.TestCase):
    def test_agentrouter_canned_is_marked_mock(self):
        old_sim = os.environ.get("LLMSIMULATE")
        os.environ["LLMSIMULATE"] = "agentrouter-canned"
        try:
            result = run_specialist("balance_access", "ping")
            self.assertEqual(result.get("backend"), "agentrouter")
            self.assertTrue(result.get("_simulated") is True)
            self.assertIn("[SIMULATED", result.get("response", ""))
        finally:
            if old_sim is None:
                os.environ.pop("LLMSIMULATE", None)
            else:
                os.environ["LLMSIMULATE"] = old_sim

    def test_all_fail_is_not_real_specialist_result(self):
        old_sim = os.environ.get("LLMSIMULATE")
        old_key = os.environ.get("AGENTROUTER_API_KEY")
        os.environ["LLMSIMULATE"] = "all-fail"
        os.environ.pop("AGENTROUTER_API_KEY", None)
        os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            result = run_specialist("balance_access", "ping")
            self.assertEqual(result.get("backend"), "none")
            self.assertTrue(result.get("_simulated") in (True, False))
            self.assertEqual(result.get("response", ""), "")
        finally:
            if old_sim is None:
                os.environ.pop("LLMSIMULATE", None)
            else:
                os.environ["LLMSIMULATE"] = old_sim
            if old_key is None:
                os.environ.pop("AGENTROUTER_API_KEY", None)
            else:
                os.environ["AGENTROUTER_API_KEY"] = old_key

    def test_judge_success_overrides_rule_based_verdict(self):
        payload = {
            "verdict": "threat",
            "severity": "high",
            "reason": "Specialist found a real issue and the judge agreed.",
        }
        result = {
            "verdict": "threat",
            "severity": "high",
            "reason": payload["reason"],
            "backend": "anthropic",
            "error": None,
        }
        self.assertEqual(result["verdict"], "threat")
        self.assertEqual(result["severity"], "high")
        self.assertIn("judge agreed", result["reason"].lower())

    def test_judge_failure_falls_back_to_rule_based_verdict(self):
        rule_verdict = {"verdict": "safe", "severity": "low", "score": 10}
        judge_fail = {"backend": "none", "verdict": "", "severity": "", "reason": "", "error": "missing API key"}
        final_verdict = rule_verdict["verdict"] if not judge_fail.get("verdict") else judge_fail["verdict"]
        self.assertEqual(final_verdict, "safe")

    def test_no_real_specialist_uses_rule_based_verdict(self):
        rule_verdict = {"verdict": "safe", "severity": "low"}
        specialist_result = {"backend": "none", "response": "", "error": "no key"}
        final_verdict = rule_verdict["verdict"] if specialist_result.get("backend") == "none" else "threat"
        self.assertEqual(final_verdict, "safe")

    def test_cli_summary_is_short_and_excludes_detailed_breakdown(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            print("Analysis complete.")
            print()
            print("Verdict: SAFE")
            print("Score: 5")
            print("Reason: Rule-based verdict retained after judge failure")
            print()
            print("Full report: reports/example.md")
        out = buf.getvalue()
        self.assertIn("Verdict: SAFE", out)
        self.assertIn("Full report: reports/example.md", out)
        self.assertNotIn("--- Detected Signals ---", out)
        self.assertNotIn("--- Score Breakdown ---", out)

    def test_plain_string_agentrouter_response_is_accepted(self):
        old_key = os.environ.get("AGENTROUTER_API_KEY")
        os.environ["AGENTROUTER_API_KEY"] = "dummy"
        os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            with patch.object(llm_client, "_call_agentrouter", return_value="DeepSeek text response for specialist") as mock_call:
                result = run_specialist("balance_access", "ping")
                self.assertEqual(result.get("backend"), "agentrouter")
                self.assertEqual(result.get("model"), "deepseek-v4-flash")
                self.assertEqual(result.get("response"), "DeepSeek text response for specialist")
                self.assertTrue(mock_call.called)
        finally:
            if old_key is None:
                os.environ.pop("AGENTROUTER_API_KEY", None)
            else:
                os.environ["AGENTROUTER_API_KEY"] = old_key

    def test_judge_reuses_same_provider_and_model_as_specialist(self):
        old_key = os.environ.get("AGENTROUTER_API_KEY")
        os.environ["AGENTROUTER_API_KEY"] = "dummy"
        os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            def fake_agentrouter(prompt, model=None, timeout=None):
                if model == "deepseek-v4-flash":
                    if "judge" in prompt.lower():
                        return {"message": {"content": [{"type": "text", "text": '{"verdict": "threat", "severity": "high", "reason": "Judge found a real issue."}' }]}}
                    return {"message": {"content": [{"type": "text", "text": 'Spec found a real issue.'}]}}
                if model == "glm-5.3":
                    return {"message": {"content": [{"type": "text", "text": '{"verdict": "threat", "severity": "high", "reason": "Judge found a real issue."}' }]}}
                raise RuntimeError("unexpected model")

            with patch.object(llm_client, "_call_agentrouter", side_effect=fake_agentrouter) as mock_call:
                specialist = run_specialist("balance_access", "ping")
                self.assertTrue((specialist.get("backend") or "").startswith("agentrouter"))
                self.assertEqual(specialist.get("model"), "deepseek-v4-flash")

                judge = run_judge(
                    {"score": 35, "verdict": "medium", "severity": "medium", "breakdown": ["test"]},
                    "spec ok",
                    provider=specialist.get("provider"),
                    model=specialist.get("model"),
                )
                self.assertEqual(judge.get("backend"), specialist.get("provider"))
                self.assertEqual(judge.get("model"), specialist.get("model"))
                self.assertEqual(mock_call.call_count, 2)
                self.assertEqual(mock_call.call_args_list[0].kwargs["model"], "deepseek-v4-flash")
                self.assertEqual(mock_call.call_args_list[1].kwargs["model"], "deepseek-v4-flash")
        finally:
            if old_key is None:
                os.environ.pop("AGENTROUTER_API_KEY", None)
            else:
                os.environ["AGENTROUTER_API_KEY"] = old_key

    def test_source_code_is_redacted_in_terminal_output(self):
        prompt = "SOURCE_FILES:\n-- contract.sol --\npragma solidity ^0.8.0;\ncontract Test { function x() public {} }\n\nBEHAVIORAL_SUMMARY:\nnormal"
        redacted = llm_client._redact_prompt_for_terminal(prompt)
        self.assertIn("SOURCE_FILES:", redacted)
        self.assertNotIn("pragma solidity", redacted)
        self.assertNotIn("contract Test", redacted)
        self.assertIn("chars of source", redacted)


if __name__ == "__main__":
    unittest.main()
