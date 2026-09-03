import unittest

from core.tx_analysis import analyze_transactions


class TestTxAnalysisValueFilters(unittest.TestCase):
    def test_zero_value_inbound_does_not_trigger_honeypot(self):
        inbound = [
            {"from": f"0x{i:040x}", "to": "0x1234567890123456789012345678901234567890", "value": 0.0}
            for i in range(20)
        ]
        outbound = []
        res = analyze_transactions(
            address="0x1234567890123456789012345678901234567890",
            inbound=inbound,
            outbound=outbound,
            normal_txs=[],
            balance_eth=0.0,
        )
        labels = [f["label"] for f in res["findings"]]
        self.assertNotIn(
            "Honeypot signal: tokens flowing IN with zero outbound transfers",
            labels,
        )

    def test_real_value_inbound_outbound_still_triggers_honeypot(self):
        inbound = [
            {"from": f"0x{i:040x}", "to": "0x1234567890123456789012345678901234567890", "value": 1.0}
            for i in range(20)
        ]
        outbound = []
        res = analyze_transactions(
            address="0x1234567890123456789012345678901234567890",
            inbound=inbound,
            outbound=outbound,
            normal_txs=[],
            balance_eth=0.0,
        )
        labels = [f["label"] for f in res["findings"]]
        self.assertIn(
            "Honeypot signal: tokens flowing IN with zero outbound transfers",
            labels,
        )


if __name__ == "__main__":
    unittest.main()
