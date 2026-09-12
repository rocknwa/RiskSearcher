"""Circle Arc (Layer-1) treasury integration for RiskSearcher.

Arc is Circle's stablecoin-native L1: USDC is Arc's *native* asset (like ETH
is native on Ethereum), not an ERC-20 token on it. This module uses Circle's
official `circle-developer-controlled-wallets` Python SDK to give each
connected user a real Developer-Controlled Wallet on Arc Testnet, and to
move real testnet USDC for wallet transfers and scan-pack payments.

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
     this is where scan-pack payments are sent.
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


def _arc_blockchain() -> str:
    """ARC-TESTNET by default; set ARC_BLOCKCHAIN=ARC to point this whole
    module at Arc mainnet with no code change - just the env var plus real
    (mainnet) CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET / CIRCLE_WALLET_SET_ID."""
    return os.environ.get("ARC_BLOCKCHAIN", "ARC-TESTNET").strip() or "ARC-TESTNET"


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
    creating one on first use.

    The local data/arc_state.json cache is a fast path, not the source of
    truth - Render's disk is ephemeral, so a redeploy or restart wipes it.
    On a cache miss, this checks Circle's own ref_id index for an existing
    wallet before creating a new one, so a redeploy doesn't silently hand
    the same user a brand-new (empty) wallet. Every wallet gets its ref_id
    set to this user's address right after creation specifically so that
    lookup works."""
    client = _get_client()
    if client is None:
        return _unavailable("circle_not_configured")

    key = (user_address or "").strip().lower()
    if not key:
        return _unavailable("missing_user_address")

    # Namespaced by network so a future mainnet switch (ARC_BLOCKCHAIN=ARC)
    # can never accidentally reuse a cached testnet wallet, or vice versa.
    cache_key = f"{_arc_blockchain()}:{key}"

    with _STATE_LOCK:
        cached = _load_state().get("wallets", {}).get(cache_key)
    if cached:
        return {"no_data": False, "wallet_id": cached["wallet_id"], "deposit_address": cached["address"]}

    try:
        from circle.web3 import developer_controlled_wallets as dcw

        wallet_set_id = _get_or_create_wallet_set(client)
        if not wallet_set_id:
            return _unavailable("wallet_set_unavailable")

        api = dcw.WalletsApi(client)

        # Cache miss doesn't mean "no wallet exists" - it may just mean the
        # local cache was wiped by a redeploy. Check Circle's own index by
        # ref_id before creating a new (empty) wallet for a returning user.
        # blockchain= scopes this to the current network for the same
        # reason the local cache key is namespaced above.
        existing = api.get_wallets(wallet_set_id=wallet_set_id, ref_id=key, blockchain=_arc_blockchain())
        existing_wallets = (existing.data.wallets or []) if existing.data else []
        if existing_wallets:
            wallet = existing_wallets[0]
            with _STATE_LOCK:
                state = _load_state()
                state.setdefault("wallets", {})[cache_key] = {"wallet_id": wallet.id, "address": wallet.address}
                _save_state(state)
            return {"no_data": False, "wallet_id": wallet.id, "deposit_address": wallet.address}

        request = dcw.CreateWalletRequest.from_dict({
            "walletSetId": wallet_set_id,
            "blockchains": [_arc_blockchain()],
            "count": 1,
            "metadata": [{"name": f"riskSearcher-{key[:10]}"}],
        })
        response = api.create_wallet(request)
        wallet = response.data.wallets[0]

        # Set ref_id right away so a future cache-miss (e.g. after the next
        # redeploy) can find this exact wallet again via get_wallets above,
        # instead of creating yet another empty one for the same user.
        try:
            api.update_wallet(id=wallet.id, update_wallet_request=dcw.UpdateWalletRequest.from_dict({"refId": key}))
        except Exception as exc:
            print(f"    [ARC] Wallet {wallet.id} created but ref_id could not be set: {exc}")

        with _STATE_LOCK:
            state = _load_state()
            state.setdefault("wallets", {})[cache_key] = {"wallet_id": wallet.id, "address": wallet.address}
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
    wallet on Arc Testnet. Used for direct Arc transfers and scan-pack
    payments — it is not a fiat off-ramp or bridge."""
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
            # Circle's transfer API requires either tokenId/tokenAddress (an
            # ERC-20 transfer) or blockchain (a native-asset transfer) to be
            # set - USDC is Arc's native asset, so this is a native transfer
            # and blockchain is the one that applies. Confirmed live: a run
            # without this field failed with "'tokenId' field may not be
            # empty when 'Blockchain' field is not set".
            "blockchain": _arc_blockchain(),
        })
        response = api.create_developer_transaction_transfer(request)
        return {"no_data": False, "transaction_id": response.data.id, "status": response.data.state}
    except Exception as exc:
        print(f"    [ARC] Transfer failed from wallet {wallet_id} to {destination_address}: {exc}")
        return _unavailable("transfer_failed")


def _circle_api_request(path: str, params: dict | None = None) -> dict:
    """Small read-only REST helper for transaction status/history.

    The Python DCW SDK is used for wallet creation/transfers above.  Circle's
    REST transaction endpoints are intentionally used for reads here because
    their response shape is stable across SDK generator versions and lets the
    backend reconcile initiated payments after a restart.
    """
    api_key = os.environ.get("CIRCLE_API_KEY", "").strip()
    if not api_key:
        return _unavailable("circle_not_configured")
    base = os.environ.get("CIRCLE_API_BASE_URL", "https://api.circle.com").strip().rstrip("/")
    try:
        import requests
        response = requests.get(
            f"{base}{path}",
            params=params,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=20,
        )
        if response.status_code >= 400:
            print(f"    [ARC] Circle REST {path} returned {response.status_code}: {response.text[:300]}")
            return _unavailable(f"circle_http_{response.status_code}")
        return {"no_data": False, "payload": response.json()}
    except Exception as exc:
        print(f"    [ARC] Circle REST request failed for {path}: {exc}")
        return _unavailable("circle_request_failed")


def get_transaction(transaction_id: str) -> dict:
    """Return Circle's live state/txHash for one developer-wallet tx."""
    if not transaction_id:
        return _unavailable("missing_transaction_id")
    raw = _circle_api_request(f"/v1/w3s/transactions/{transaction_id}")
    if raw.get("no_data"):
        return raw
    payload = raw.get("payload") or {}
    data = payload.get("data") or {}
    tx = data.get("transaction") or data
    if not isinstance(tx, dict):
        return _unavailable("invalid_transaction_response")
    return {
        "no_data": False,
        "transaction_id": tx.get("id") or transaction_id,
        "status": str(tx.get("state") or tx.get("status") or "UNKNOWN").upper(),
        "tx_hash": tx.get("txHash") or tx.get("tx_hash") or "",
        "raw": tx,
    }


def list_wallet_transactions(wallet_id: str, limit: int = 50) -> dict:
    """Real Circle transaction history for one RiskSearcher DCW wallet."""
    if not wallet_id:
        return _unavailable("missing_wallet_id")
    raw = _circle_api_request(
        "/v1/w3s/transactions",
        params={
            "walletIds": wallet_id,
            "blockchain": _arc_blockchain(),
            "includeAll": "true",
            "pageSize": max(1, min(int(limit), 50)),
        },
    )
    if raw.get("no_data"):
        return raw
    payload = raw.get("payload") or {}
    data = payload.get("data") or {}
    transactions = data.get("transactions") or []
    if not isinstance(transactions, list):
        return _unavailable("invalid_transaction_list_response")
    return {"no_data": False, "transactions": transactions}
