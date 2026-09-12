import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import server


class HistoryEndpointTests(unittest.TestCase):
    def setUp(self):
        server.app.dependency_overrides[server.require_session] = lambda: "0xuser"
        self.client = TestClient(server.app)

    def tearDown(self):
        server.app.dependency_overrides.clear()

    @patch("api.server.scan_history_store.get_scan_history")
    def test_history_returns_records_for_authenticated_wallet(self, mock_get_history):
        mock_get_history.return_value = {
            "no_data": False,
            "records": [{"doc_id": "d1", "verdict": "SAFE", "contract_address": "0xAbc"}],
        }
        response = self.client.get("/history")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["records"]), 1)
        mock_get_history.assert_called_once_with("0xuser")

    @patch("api.server.scan_history_store.get_scan_history")
    def test_history_surfaces_unconfigured_state_without_raising(self, mock_get_history):
        mock_get_history.return_value = {"no_data": True, "reason": "firestore_not_configured"}
        response = self.client.get("/history")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["no_data"])


if __name__ == "__main__":
    unittest.main()
