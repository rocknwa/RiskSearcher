import os
import unittest
from unittest.mock import MagicMock, Mock, patch

import db.scan_history_store as scan_history_store


class ScanHistoryStoreTests(unittest.TestCase):
    def setUp(self):
        scan_history_store.reset_client_cache()

    def tearDown(self):
        scan_history_store.reset_client_cache()

    @patch.dict(os.environ, {}, clear=False)
    def test_missing_credentials_degrade_cleanly_on_save(self):
        os.environ.pop("FIRESTORE_CREDENTIALS_JSON", None)

        result = scan_history_store.save_scan("0xUser", {"verdict": "SAFE"})

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "firestore_not_configured")

    @patch.dict(os.environ, {}, clear=False)
    def test_missing_credentials_degrade_cleanly_on_fetch(self):
        os.environ.pop("FIRESTORE_CREDENTIALS_JSON", None)

        result = scan_history_store.get_scan_history("0xUser")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "firestore_not_configured")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.scan_history_store._get_client")
    def test_save_scan_writes_to_the_collection_with_user_address(self, mock_get_client):
        mock_client = Mock()
        mock_doc_ref = Mock(id="doc-123")
        mock_client.collection.return_value.add.return_value = (Mock(), mock_doc_ref)
        mock_get_client.return_value = mock_client

        result = scan_history_store.save_scan("0xUSER", {"verdict": "THREAT", "score": 70})

        self.assertFalse(result["no_data"])
        self.assertEqual(result["doc_id"], "doc-123")
        mock_client.collection.assert_called_once_with(scan_history_store.COLLECTION)
        saved_record = mock_client.collection.return_value.add.call_args.args[0]
        # Address is lowercased for consistent lookup regardless of how the
        # wallet connector cased it.
        self.assertEqual(saved_record["user_address"], "0xuser")
        self.assertEqual(saved_record["verdict"], "THREAT")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.scan_history_store._get_client")
    def test_get_scan_history_returns_records_most_recent_first(self, mock_get_client):
        mock_client = Mock()
        doc1 = Mock(id="doc-1")
        doc1.to_dict.return_value = {"verdict": "SAFE", "saved_at": None}
        mock_query = MagicMock()
        mock_query.stream.return_value = [doc1]
        mock_client.collection.return_value.where.return_value.order_by.return_value.limit.return_value = mock_query
        mock_get_client.return_value = mock_client

        result = scan_history_store.get_scan_history("0xUser")

        self.assertFalse(result["no_data"])
        self.assertEqual(len(result["records"]), 1)
        self.assertEqual(result["records"][0]["doc_id"], "doc-1")
        self.assertEqual(result["records"][0]["verdict"], "SAFE")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.scan_history_store._get_client")
    def test_save_scan_failure_degrades_cleanly(self, mock_get_client):
        mock_client = Mock()
        mock_client.collection.return_value.add.side_effect = RuntimeError("firestore offline")
        mock_get_client.return_value = mock_client

        result = scan_history_store.save_scan("0xUser", {"verdict": "SAFE"})

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "save_failed")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.scan_history_store._get_client")
    def test_missing_user_address_is_rejected_without_calling_firestore(self, mock_get_client):
        mock_get_client.return_value = Mock()

        result = scan_history_store.save_scan("", {"verdict": "SAFE"})

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "missing_user_address")


if __name__ == "__main__":
    unittest.main()
