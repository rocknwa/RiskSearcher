import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import server


class ArcEndpointTests(unittest.TestCase):
    def setUp(self):
        server.app.dependency_overrides[server.require_session] = lambda: "0xuser"
        self.client = TestClient(server.app)

    def tearDown(self):
        server.app.dependency_overrides.clear()

    @patch("api.server.arc_provider.get_wallet_balance")
    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_get_wallet_returns_real_shaped_payload(self, mock_get_wallet, mock_get_balance):
        mock_get_wallet.return_value = {"no_data": False, "wallet_id": "w-1", "deposit_address": "0xDep"}
        mock_get_balance.return_value = {"no_data": False, "usdc_balance": 42.5}

        response = self.client.get("/arc/wallet")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["no_data"])
        self.assertEqual(body["deposit_address"], "0xDep")
        self.assertEqual(body["usdc_balance"], 42.5)
        mock_get_wallet.assert_called_once_with("0xuser")

    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_get_wallet_surfaces_unconfigured_state_without_raising(self, mock_get_wallet):
        mock_get_wallet.return_value = {"no_data": True, "reason": "circle_not_configured"}
        response = self.client.get("/arc/wallet")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["no_data"])

    @patch("api.server.arc_provider.send_usdc")
    def test_withdraw_is_disabled_server_side(self, mock_send):
        response = self.client.post("/arc/withdraw")
        self.assertEqual(response.status_code, 501)
        mock_send.assert_not_called()

    @patch.dict(os.environ, {"ARC_TREASURY_ADDRESS": "0xTreasury"}, clear=False)
    @patch("api.server.entitlement_store.clear_purchase_intent")
    @patch("api.server.entitlement_store.attach_purchase_transaction")
    @patch("api.server.entitlement_store.create_pending_purchase")
    @patch("api.server.entitlement_store.begin_purchase_intent")
    @patch("api.server.entitlement_store.get_purchase_intent")
    @patch("api.server.entitlement_store.get_open_purchase_for_wallet")
    @patch("api.server.arc_provider.send_usdc")
    @patch("api.server.arc_provider.get_or_create_wallet")
    def test_scan_pack_is_fixed_five_usdc_for_ten_scans(
        self, mock_get_wallet, mock_send, mock_open_purchase, mock_get_intent, mock_begin,
        mock_create_purchase, mock_attach, mock_clear
    ):
        mock_open_purchase.return_value = {"no_data": False, "purchase": None}
        mock_get_intent.return_value = {"no_data": False, "intent": None}
        mock_begin.return_value = {"no_data": False, "acquired": True, "intent_token": "intent-1"}
        mock_get_wallet.return_value = {"no_data": False, "wallet_id": "w-1", "deposit_address": "0xDep"}
        mock_send.return_value = {"no_data": False, "transaction_id": "tx-2", "status": "INITIATED"}
        mock_attach.return_value = {"no_data": False, "status": "attached", "transaction_id": "tx-2"}
        mock_create_purchase.return_value = {"no_data": False, "transaction_id": "tx-2"}

        response = self.client.post("/arc/subscribe")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["price_usdc"], 5.0)
        self.assertEqual(body["scans"], 10)
        self.assertFalse(body["credits_granted"])
        mock_send.assert_called_once_with("w-1", "0xTreasury", 5.0)
        mock_clear.assert_called_once_with("0xuser", "intent-1")

    @patch.dict(os.environ, {"ARC_TREASURY_ADDRESS": "0xTreasury"}, clear=False)
    @patch("api.server._reconcile_purchase")
    @patch("api.server.entitlement_store.get_open_purchase_for_wallet")
    @patch("api.server.arc_provider.send_usdc")
    def test_existing_pending_purchase_is_reused_without_second_transfer(self, mock_send, mock_open_purchase, mock_reconcile):
        mock_open_purchase.return_value = {"no_data": False, "purchase": {"transaction_id": "tx-existing"}}
        mock_reconcile.return_value = {"no_data": False, "transaction_id": "tx-existing", "status": "PENDING", "credits_granted": False}

        response = self.client.post("/arc/subscribe")

        self.assertEqual(response.status_code, 200)
        mock_send.assert_not_called()
        mock_reconcile.assert_called_once_with("0xuser", "tx-existing", allow_not_found=False, reused_pending=True)

    def test_subscribe_rejects_when_treasury_address_not_configured(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ARC_TREASURY_ADDRESS", None)
            response = self.client.post("/arc/subscribe")
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
