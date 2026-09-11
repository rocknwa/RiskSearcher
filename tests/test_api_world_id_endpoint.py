import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.server import app


class WorldIdStatusEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("api.server.world_id_store.get_claim_status")
    def test_status_prefers_nullifier_when_both_are_given(self, mock_by_nullifier):
        mock_by_nullifier.return_value = {"no_data": False, "claimed": True}

        response = self.client.get("/world-id/status", params={"nullifier": "n1", "address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        mock_by_nullifier.assert_called_once_with("n1")

    @patch("api.server.world_id_store.get_claim_status_by_wallet_address")
    def test_status_falls_back_to_address_when_no_nullifier(self, mock_by_address):
        mock_by_address.return_value = {"no_data": False, "claimed": True, "nullifier": "n1"}

        response = self.client.get("/world-id/status", params={"address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nullifier"], "n1")
        mock_by_address.assert_called_once_with("0xUser")

    def test_status_requires_at_least_one_param(self):
        response = self.client.get("/world-id/status")

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
