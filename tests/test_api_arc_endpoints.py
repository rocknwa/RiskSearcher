import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.server import app


class ArcEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("api.server.arc_provider.get_wallet_balance")
    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_get_wallet_returns_real_shaped_payload(self, mock_get_wallet, mock_get_balance):
        mock_get_wallet.return_value = {"no_data": False, "wallet_id": "w-1", "deposit_address": "0xDep"}
        mock_get_balance.return_value = {"no_data": False, "usdc_balance": 42.5}

        response = self.client.get("/arc/wallet", params={"address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["no_data"])
        self.assertEqual(body["deposit_address"], "0xDep")
        self.assertEqual(body["usdc_balance"], 42.5)

    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_get_wallet_surfaces_unconfigured_state_without_raising(self, mock_get_wallet):
        mock_get_wallet.return_value = {"no_data": True, "reason": "circle_not_configured"}

        response = self.client.get("/arc/wallet", params={"address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["no_data"])
        self.assertEqual(response.json()["reason"], "circle_not_configured")

    @patch("api.server.arc_provider.send_usdc")
    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_withdraw_calls_send_usdc_with_the_users_own_wallet(self, mock_get_wallet, mock_send):
        mock_get_wallet.return_value = {"no_data": False, "wallet_id": "w-1", "deposit_address": "0xDep"}
        mock_send.return_value = {"no_data": False, "transaction_id": "tx-1", "status": "INITIATED"}

        response = self.client.post(
            "/arc/withdraw",
            json={"address": "0xUser", "destination": "0xExternal", "amount": 5.0},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["transaction_id"], "tx-1")
        mock_send.assert_called_once_with("w-1", "0xExternal", 5.0)

    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_withdraw_rejects_when_wallet_unavailable(self, mock_get_wallet):
        mock_get_wallet.return_value = {"no_data": True, "reason": "circle_not_configured"}

        response = self.client.post(
            "/arc/withdraw",
            json={"address": "0xUser", "destination": "0xExternal", "amount": 5.0},
        )

        self.assertEqual(response.status_code, 400)

    @patch.dict(os.environ, {"ARC_TREASURY_ADDRESS": "0xTreasury"}, clear=False)
    @patch("api.server.arc_provider.send_usdc")
    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_subscribe_pays_the_treasury_address(self, mock_get_wallet, mock_send):
        mock_get_wallet.return_value = {"no_data": False, "wallet_id": "w-1", "deposit_address": "0xDep"}
        mock_send.return_value = {"no_data": False, "transaction_id": "tx-2", "status": "INITIATED"}

        response = self.client.post("/arc/subscribe", json={"address": "0xUser", "plan_price": 19.99})

        self.assertEqual(response.status_code, 200)
        mock_send.assert_called_once_with("w-1", "0xTreasury", 19.99)

    @patch.dict(os.environ, {}, clear=False)
    def test_subscribe_rejects_when_treasury_address_not_configured(self):
        os.environ.pop("ARC_TREASURY_ADDRESS", None)

        response = self.client.post("/arc/subscribe", json={"address": "0xUser", "plan_price": 19.99})

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
