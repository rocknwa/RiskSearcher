import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import server


class EntitlementEndpointTests(unittest.TestCase):
    def setUp(self):
        server.app.dependency_overrides[server.require_session] = lambda: "0xuser"
        self.client = TestClient(server.app)

    def tearDown(self):
        server.app.dependency_overrides.clear()

    @patch("api.server.analyze")
    @patch("api.server.entitlement_store.reserve_scan")
    @patch("api.server.world_id_store.migrate_legacy_claim_for_wallet")
    def test_direct_analyze_is_rejected_without_credit(self, mock_migrate, mock_reserve, mock_analyze):
        mock_migrate.return_value = {"no_data": False, "migrated": False}
        mock_reserve.return_value = {
            "no_data": False,
            "allowed": False,
            "reason": "no_scan_credits",
            "entitlement": {"free_scans_remaining": 0, "paid_scans_remaining": 0},
        }
        response = self.client.get("/analyze", params={"address": "0xabc", "chain": "ethereum"})
        self.assertEqual(response.status_code, 402)
        mock_analyze.assert_not_called()
        mock_reserve.assert_called_once_with("0xuser", "0xabc", "ethereum")

    @patch("api.server.entitlement_store.get_entitlements")
    @patch("api.server.world_id_store.migrate_legacy_claim_for_wallet")
    def test_entitlements_are_wallet_scoped_server_side(self, mock_migrate, mock_get):
        mock_migrate.return_value = {"no_data": False, "migrated": False}
        mock_get.return_value = {
            "no_data": False,
            "wallet_address": "0xuser",
            "world_verified": True,
            "free_scans_granted": 3,
            "free_scans_remaining": 3,
            "paid_scans_remaining": 0,
            "total_scans_executed": 0,
        }
        response = self.client.get("/entitlements", params={"address": "0xattacker"})
        self.assertEqual(response.status_code, 200)
        mock_get.assert_called_once_with("0xuser")


if __name__ == "__main__":
    unittest.main()
