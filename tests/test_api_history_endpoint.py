import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.server import app


class HistoryEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("api.server.scan_history_store.get_scan_history")
    def test_history_returns_records(self, mock_get_history):
        mock_get_history.return_value = {
            "no_data": False,
            "records": [{"doc_id": "d1", "verdict": "SAFE", "contract_address": "0xAbc"}],
        }

        response = self.client.get("/history", params={"address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["no_data"])
        self.assertEqual(len(body["records"]), 1)
        mock_get_history.assert_called_once_with("0xUser")

    @patch("api.server.scan_history_store.get_scan_history")
    def test_history_surfaces_unconfigured_state_without_raising(self, mock_get_history):
        mock_get_history.return_value = {"no_data": True, "reason": "firestore_not_configured"}

        response = self.client.get("/history", params={"address": "0xUser"})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["no_data"])


if __name__ == "__main__":
    unittest.main()
