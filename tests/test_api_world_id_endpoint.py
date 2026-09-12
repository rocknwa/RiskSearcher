import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import server


class WorldIdStatusEndpointTests(unittest.TestCase):
    def setUp(self):
        server.app.dependency_overrides[server.require_session] = lambda: "0xuser"
        self.client = TestClient(server.app)

    def tearDown(self):
        server.app.dependency_overrides.clear()

    @patch("api.server.entitlement_store.get_entitlements")
    @patch("api.server.world_id_store.get_claim_status_by_wallet_address")
    @patch("api.server.world_id_store.migrate_legacy_claim_for_wallet")
    def test_status_uses_authenticated_wallet_only(self, mock_migrate, mock_by_address, mock_entitlements):
        mock_migrate.return_value = {"no_data": False, "migrated": False}
        mock_by_address.return_value = {"no_data": False, "claimed": True, "nullifier": "n1"}
        mock_entitlements.return_value = {
            "no_data": False,
            "wallet_address": "0xuser",
            "world_verified": True,
            "free_scans_granted": 3,
            "free_scans_remaining": 2,
            "paid_scans_remaining": 0,
            "total_scans_executed": 1,
        }

        response = self.client.get("/world-id/status", params={"address": "0xattacker"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nullifier"], "n1")
        mock_by_address.assert_called_once_with("0xuser")
        mock_migrate.assert_called_once_with("0xuser")


if __name__ == "__main__":
    unittest.main()
