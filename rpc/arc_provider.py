"""Circle Arc (Layer-1) treasury integration for RiskSearcher.

Arc is Circle's stablecoin-native L1: USDC is Arc's *native* asset (like ETH
is native on Ethereum), not an ERC-20 token on it. This module uses Circle's
official `circle-developer-controlled-wallets` Python SDK to give each
connected user a real Developer-Controlled Wallet on Arc Testnet, and to
move real USDC for deposits, withdrawals, and subscription payments.

Degrades cleanly to a `no_data`-shaped dict when CIRCLE_API_KEY /
CIRCLE_ENTITY_SECRET aren't configured or a call fails, matching the
pattern already established in rpc/graph_provider.py.

Setup required (see README for the full walkthrough):
  1. Create a Circle Developer account and API key at console.circle.com.
  2. Generate + register an entity secret (one-time):
       pip install circle-developer-controlled-wallets
       python -c "from circle.web3 import utils; utils.generate_entity_secret()"
     then follow Circle's registration flow — this produces a recovery
     file you must store safely; losing it loses wallet access permanently.
  3. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET as environment variables.
  4. (Optional) Set CIRCLE_WALLET_SET_ID to reuse an existing wallet set;
     otherwise one is created automatically on first use and cached in
     data/arc_state.json.
  5. Set ARC_TREASURY_ADDRESS to a real Arc Testnet address you control —
     this is where subscription payments are sent.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Optional

STATE_PATH = Path(os.environ.get("ARC_STATE_PATH", "data/arc_state.json"))
_STATE_LOCK = threading.Lock()
_client = None
_client_checked = False


def _unavailable(reason: str) -> dict:
    return {"no_data": True, "reason": reason}


def _load_state() -> dict:
    if not STATE_PATH.exists():
        return {"wallet_set_id": None, "wallets": {}}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"wallet_set_id": None, "wallets": {}}


def _save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def reset_client_cache() -> None:
    """Test-only: force the next _get_client() call to re-read env vars."""
    global _client, _client_checked
    _client, _client_checked = None, False


def _get_client():
    """Lazily build the Circle SDK client. Returns None if not configured."""
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    api_key = os.environ.get("CIRCLE_API_KEY", "").strip()
    entity_secret = os.environ.get("CIRCLE_ENTITY_SECRET", "").strip()
    if not api_key or not entity_secret:
        print("    [ARC] CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET not set; Arc treasury features disabled")
        return None
    try:
        from circle.web3 import utils

        _client = utils.init_developer_controlled_wallets_client(
            api_key=api_key, entity_secret=entity_secret,
        )
    except Exception as exc:
        print(f"    [ARC] Failed to initialize Circle client: {exc}")
        _client = None
    return _client


def _get_or_create_wallet_set(client) -> Optional[str]:
    configured = os.environ.get("CIRCLE_WALLET_SET_ID", "").strip()
    if configured:
        return configured

    with _STATE_LOCK:
        state = _load_state()
        if state.get("wallet_set_id"):
            return state["wallet_set_id"]

        from circle.web3 import developer_controlled_wallets as dcw

        api = dcw.WalletSetsApi(client)
        request = dcw.CreateWalletSetRequest.from_dict({"name": "risksearcher-treasury"})
        response = api.create_wallet_set(request)
        wallet_set_id = response.data.wallet_set.id
        state["wallet_set_id"] = wallet_set_id
        _save_state(state)
        return wallet_set_id


def get_or_create_wallet(user_address: str) -> dict:
    """Return a real Arc Testnet Developer-Controlled Wallet for this user,
    creating one on first use. The mapping is cached in data/arc_state.json
    so the same user always gets the same deposit address back."""
    client = _get_client()
    if client is None:
        return _unavailable("circle_not_configured")

    key = (user_address or "").strip().lower()
    if not key:
        return _unavailable("missing_user_address")

    with _STATE_LOCK:
        cached = _load_state().get("wallets", {}).get(key)
    if cached:
        return {"no_data": False, "wallet_id": cached["wallet_id"], "deposit_address": cached["address"]}

    try:
        from circle.web3 import developer_controlled_wallets as dcw

        wallet_set_id = _get_or_create_wallet_set(client)
        if not wallet_set_id:
            return _unavailable("wallet_set_unavailable")

        api = dcw.WalletsApi(client)
        request = dcw.CreateWalletRequest.from_dict({
            "walletSetId": wallet_set_id,
            "blockchains": ["ARC-TESTNET"],
            "count": 1,
            "metadata": [{"name": f"riskSearcher-{key[:10]}"}],
        })
        response = api.create_wallet(request)
        wallet = response.data.wallets[0]

        with _STATE_LOCK:
            state = _load_state()
            state.setdefault("wallets", {})[key] = {"wallet_id": wallet.id, "address": wallet.address}
            _save_state(state)

        return {"no_data": False, "wallet_id": wallet.id, "deposit_address": wallet.address}
    except Exception as exc:
        print(f"    [ARC] Failed to create wallet for {key}: {exc}")
        return _unavailable("wallet_creation_failed")


def get_wallet_balance(wallet_id: str) -> dict:
    """Live USDC balance for a wallet. USDC is Arc's native gas asset, so
    this reads the native balance entry rather than an ERC-20 balance."""
    client = _get_client()
    if client is None:
        return _unavailable("circle_not_configured")
    try:
        from circle.web3 import developer_controlled_wallets as dcw

        api = dcw.WalletsApi(client)
        response = api.list_wallet_balance(id=wallet_id, include_all=True)
        balances = (response.data.token_balances or []) if response.data else []
        usdc = next(
            (b for b in balances if b.token and (b.token.is_native or (b.token.symbol or "").upper() == "USDC")),
            None,
        )
        amount = float(usdc.amount) if usdc and usdc.amount is not None else 0.0
        return {"no_data": False, "usdc_balance": amount}
    except Exception as exc:
        print(f"    [ARC] Failed to fetch balance for wallet {wallet_id}: {exc}")
        return _unavailable("balance_fetch_failed")


def send_usdc(wallet_id: str, destination_address: str, amount: float) -> dict:
    """Real, on-chain native-USDC transfer out of a Developer-Controlled
    wallet on Arc Testnet. Used for both user withdrawals and subscription
    payments — same underlying operation, different destination address."""
    client = _get_client()
    if client is None:
        return _unavailable("circle_not_configured")
    if not destination_address:
        return _unavailable("missing_destination")
    if amount is None or amount <= 0:
        return _unavailable("invalid_amount")
    try:
        from circle.web3 import developer_controlled_wallets as dcw

        api = dcw.TransactionsApi(client)
        request = dcw.CreateTransferTransactionForDeveloperRequest.from_dict({
            "walletId": wallet_id,
            "destinationAddress": destination_address,
            "amounts": [str(amount)],
            "feeLevel": "MEDIUM",
        })
        response = api.create_developer_transaction_transfer(request)
        return {"no_data": False, "transaction_id": response.data.id, "status": response.data.state}
    except Exception as exc:
        print(f"    [ARC] Transfer failed from wallet {wallet_id} to {destination_address}: {exc}")
        return _unavailable("transfer_failed")
