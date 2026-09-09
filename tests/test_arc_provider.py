import os
import unittest
from unittest.mock import Mock, patch

import rpc.arc_provider as arc_provider


class ArcProviderTests(unittest.TestCase):
    def setUp(self):
        arc_provider.reset_client_cache()
        self.state_path = arc_provider.STATE_PATH
        if self.state_path.exists():
            self.state_path.unlink()

    def tearDown(self):
        arc_provider.reset_client_cache()
        if self.state_path.exists():
            self.state_path.unlink()

    @patch.dict(os.environ, {}, clear=False)
    def test_missing_credentials_degrade_cleanly(self):
        os.environ.pop("CIRCLE_API_KEY", None)
        os.environ.pop("CIRCLE_ENTITY_SECRET", None)

        result = arc_provider.get_or_create_wallet("0xUser")

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "circle_not_configured")

    @patch.dict(
        os.environ,
        {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64, "CIRCLE_WALLET_SET_ID": "ws-fixed"},
        clear=False,
    )
    @patch("rpc.arc_provider._get_client")
    def test_creates_and_caches_wallet(self, mock_get_client):
        mock_get_client.return_value = Mock()

        wallet = Mock(id="wallet-1", address="0xArcDeposit123")
        response = Mock()
        response.data.wallets = [wallet]

        with patch(
            "circle.web3.developer_controlled_wallets.WalletsApi.create_wallet",
            return_value=response,
        ) as create_wallet:
            result = arc_provider.get_or_create_wallet("0xUser1")
            self.assertFalse(result["no_data"])
            self.assertEqual(result["wallet_id"], "wallet-1")
            self.assertEqual(result["deposit_address"], "0xArcDeposit123")
            create_wallet.assert_called_once()

            # Same user again: served from the local cache, no second API call.
            result_again = arc_provider.get_or_create_wallet("0xUser1")
            self.assertEqual(result_again["deposit_address"], "0xArcDeposit123")
            create_wallet.assert_called_once()

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_get_wallet_balance_reads_native_usdc(self, mock_get_client):
        mock_get_client.return_value = Mock()

        native_token = Mock(is_native=True, symbol="USDC")
        balance = Mock(amount="123.45", token=native_token)
        response = Mock()
        response.data.token_balances = [balance]

        with patch(
            "circle.web3.developer_controlled_wallets.WalletsApi.list_wallet_balance",
            return_value=response,
        ):
            result = arc_provider.get_wallet_balance("wallet-1")

        self.assertFalse(result["no_data"])
        self.assertEqual(result["usdc_balance"], 123.45)

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_get_wallet_balance_defaults_to_zero_when_no_usdc_entry(self, mock_get_client):
        mock_get_client.return_value = Mock()
        response = Mock()
        response.data.token_balances = []

        with patch(
            "circle.web3.developer_controlled_wallets.WalletsApi.list_wallet_balance",
            return_value=response,
        ):
            result = arc_provider.get_wallet_balance("wallet-1")

        self.assertFalse(result["no_data"])
        self.assertEqual(result["usdc_balance"], 0.0)

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_send_usdc_success(self, mock_get_client):
        mock_get_client.return_value = Mock()
        response = Mock()
        response.data.id = "tx-1"
        response.data.state = "INITIATED"

        with patch(
            "circle.web3.developer_controlled_wallets.TransactionsApi.create_developer_transaction_transfer",
            return_value=response,
        ) as transfer:
            result = arc_provider.send_usdc("wallet-1", "0xDest", 5.0)

        self.assertFalse(result["no_data"])
        self.assertEqual(result["transaction_id"], "tx-1")
        self.assertEqual(result["status"], "INITIATED")
        transfer.assert_called_once()

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_send_usdc_rejects_non_positive_amount(self, mock_get_client):
        mock_get_client.return_value = Mock()

        result = arc_provider.send_usdc("wallet-1", "0xDest", 0)

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "invalid_amount")

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_send_usdc_rejects_missing_destination(self, mock_get_client):
        mock_get_client.return_value = Mock()

        result = arc_provider.send_usdc("wallet-1", "", 5.0)

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "missing_destination")

    @patch.dict(os.environ, {"CIRCLE_API_KEY": "key", "CIRCLE_ENTITY_SECRET": "a" * 64}, clear=False)
    @patch("rpc.arc_provider._get_client")
    def test_transfer_failure_degrades_cleanly(self, mock_get_client):
        mock_get_client.return_value = Mock()

        with patch(
            "circle.web3.developer_controlled_wallets.TransactionsApi.create_developer_transaction_transfer",
            side_effect=RuntimeError("gateway offline"),
        ):
            result = arc_provider.send_usdc("wallet-1", "0xDest", 5.0)

        self.assertTrue(result["no_data"])
        self.assertEqual(result["reason"], "transfer_failed")


if __name__ == "__main__":
    unittest.main()
