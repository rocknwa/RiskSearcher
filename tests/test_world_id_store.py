import os
import unittest
from unittest.mock import MagicMock, Mock, patch

import db.world_id_store as world_id_store


class WorldIdStoreTests(unittest.TestCase):
    def setUp(self):
        world_id_store.reset_client_cache()

    def tearDown(self):
        world_id_store.reset_client_cache()

    @patch.dict(os.environ, {}, clear=False)
    def test_missing_credentials_degrade_cleanly_on_status_by_wallet(self):
        os.environ.pop("FIRESTORE_CREDENTIALS_JSON", None)

        result = world_id_store.get_claim_status_by_wallet_address("0xUser")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "firestore_not_configured")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.world_id_store._get_client")
    def test_missing_wallet_address_is_rejected_without_calling_firestore(self, mock_get_client):
        mock_get_client.return_value = Mock()

        result = world_id_store.get_claim_status_by_wallet_address("")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "missing_wallet_address")

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.world_id_store._get_client")
    def test_status_by_wallet_address_finds_an_existing_claim(self, mock_get_client):
        # Reproduces the real bug: a human verified on their phone (claim
        # record exists, keyed by nullifier), then opens the same wallet on
        # a desktop browser that has never itself completed Selfie Check
        # and so has no locally-cached nullifier to check with - only the
        # wallet address is available on that device.
        mock_client = Mock()
        doc = Mock()
        doc.to_dict.return_value = {
            "nullifier": "real-nullifier-abc",
            "wallet_address": "0xuser",
            "scans_granted": 3,
            "claimed_at": None,
        }
        mock_query = MagicMock()
        mock_query.stream.return_value = [doc]
        mock_client.collection.return_value.where.return_value.limit.return_value = mock_query
        mock_get_client.return_value = mock_client

        result = world_id_store.get_claim_status_by_wallet_address("0xUSER")

        self.assertFalse(result["no_data"])
        self.assertTrue(result["claimed"])
        self.assertEqual(result["nullifier"], "real-nullifier-abc")
        self.assertEqual(result["scans_granted"], 3)

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.world_id_store._get_client")
    def test_status_by_wallet_address_returns_unclaimed_when_no_record(self, mock_get_client):
        mock_client = Mock()
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        mock_client.collection.return_value.where.return_value.limit.return_value = mock_query
        mock_get_client.return_value = mock_client

        result = world_id_store.get_claim_status_by_wallet_address("0xNeverVerified")

        self.assertFalse(result["no_data"])
        self.assertFalse(result["claimed"])

    @patch.dict(os.environ, {"FIRESTORE_CREDENTIALS_JSON": "{}"}, clear=False)
    @patch("db.world_id_store._get_client")
    def test_status_by_wallet_address_failure_degrades_cleanly(self, mock_get_client):
        mock_client = Mock()
        mock_client.collection.return_value.where.side_effect = RuntimeError("firestore offline")
        mock_get_client.return_value = mock_client

        result = world_id_store.get_claim_status_by_wallet_address("0xUser")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "fetch_failed")


if __name__ == "__main__":
    unittest.main()
