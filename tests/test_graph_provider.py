import os
import unittest
from unittest.mock import Mock, patch

from rpc.graph_provider import get_token_liquidity_data


class GraphProviderTests(unittest.TestCase):
    token = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

    @patch.dict(os.environ, {"GRAPH_API_KEY": "test-key"}, clear=False)
    @patch("rpc.graph_provider.time.time", return_value=1_700_000_000)
    @patch("rpc.graph_provider.requests.post")
    def test_parses_gateway_liquidity_response(self, post, _time):
        response = Mock()
        response.json.return_value = {
            "data": {
                "token": {
                    "totalValueLockedUSD": "1234.50",
                    "poolCount": "2",
                },
                "token0Pools": [
                        {
                            "id": "pool-1",
                            "swaps": [{"timestamp": "1600000000"}],
                            "poolDayData": [
                                {"date": "1699990000", "volumeUSD": "12.5"},
                                {"date": "1699700000", "volumeUSD": "100.0"},
                            ],
                        },
                ],
                "token1Pools": [
                        {
                            "id": "pool-2",
                            "swaps": [{"timestamp": "1650000000"}],
                            "poolDayData": [{"date": "1699800000", "volumeUSD": "25.0"}],
                        },
                    ],
            }
        }
        post.return_value = response

        result = get_token_liquidity_data(self.token, "ethereum")

        self.assertFalse(result["no_data"])
        self.assertEqual(result["total_liquidity_usd"], 1234.5)
        self.assertEqual(result["pool_count"], 2)
        self.assertEqual(result["first_swap_timestamp"], 1600000000)
        self.assertEqual(result["recent_swap_volume_usd"], {"24h": 12.5, "7d": 137.5})
        self.assertIn("gateway.thegraph.com", post.call_args.args[0])
        self.assertEqual(post.call_args.kwargs["json"]["variables"]["token"], self.token.lower())

    @patch.dict(os.environ, {"GRAPH_API_KEY": ""}, clear=False)
    @patch("rpc.graph_provider.requests.post")
    def test_missing_key_returns_no_data_without_request(self, post):
        result = get_token_liquidity_data(self.token, "ethereum")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "missing_api_key")
        post.assert_not_called()

    @patch.dict(os.environ, {"GRAPH_API_KEY": "test-key"}, clear=False)
    @patch("rpc.graph_provider.requests.post", side_effect=RuntimeError("gateway offline"))
    def test_gateway_failure_returns_no_data(self, _post):
        result = get_token_liquidity_data(self.token, "ethereum")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "request_failed")
        self.assertIsNone(result["total_liquidity_usd"])


if __name__ == "__main__":
    unittest.main()
