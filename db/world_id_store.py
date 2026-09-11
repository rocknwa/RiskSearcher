"""Firestore-backed World ID Selfie Check trial-claim ledger, keyed by the
World ID `nullifier` - NOT by wallet address.

This is the actual Sybil-defense mechanism the World/Selfie Check track
exists to provide. The nullifier returned by World's verify API is a
stable identifier for one human doing one action, that stays the same no
matter which wallet address they connect with afterward. Keying the
ledger on wallet address instead would defeat the entire point: someone
could verify once, then connect a fresh wallet and claim another 15 free
scans, then another, indefinitely.

Uses Firestore's atomic document-create (fails if a doc with that ID
already exists) as the claim mechanism, so "one human, one trial" is
enforced by Firestore itself - not by a read-then-write race in
application code that a fast-enough double-request could slip through.

Same discipline as db/scan_history_store.py: degrades cleanly to a
no_data-shaped dict when FIRESTORE_CREDENTIALS_JSON isn't configured or a
call fails. A Firestore outage must never crash the verify flow; the
caller (api/server.py) is expected to surface no_data as a clear error to
the frontend rather than silently granting or denying a trial.

Reuses the same FIRESTORE_CREDENTIALS_JSON env var and Firestore project
as scan_history_store.py - just a different collection.
"""

from __future__ import annotations

import json
import os

_client = None
_client_checked = False

COLLECTION = "world_id_trial_claims"
TRIAL_SCANS_GRANTED = 15


def _unavailable(reason: str) -> dict:
    return {"no_data": True, "reason": reason}


def reset_client_cache() -> None:
    """Test-only: force the next _get_client() call to re-read env vars."""
    global _client, _client_checked
    _client, _client_checked = None, False


def _get_client():
    """Lazily build the Firestore client. Returns None if not configured."""
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True

    raw_credentials = os.environ.get("FIRESTORE_CREDENTIALS_JSON", "").strip()
    if not raw_credentials:
        print("    [WORLD_ID] FIRESTORE_CREDENTIALS_JSON not set; trial-claim ledger disabled")
        return None

    try:
        from google.cloud import firestore
        from google.oauth2 import service_account

        info = json.loads(raw_credentials)
        credentials = service_account.Credentials.from_service_account_info(info)
        _client = firestore.Client(project=info.get("project_id"), credentials=credentials)
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to initialize Firestore client: {exc}")
        _client = None
    return _client


def claim_trial(nullifier: str, wallet_address: str) -> dict:
    """Atomically claim the one-time free trial for this nullifier.

    Returns {"no_data": False, "claimed": True, "scans_granted": N} on a
    first-time claim, or {"no_data": False, "claimed": False,
    "reason": "already_claimed", "wallet_address": <original claiming
    wallet>} if this human already used their trial - including via a
    different wallet address, which is the entire reason this is keyed
    on nullifier instead of wallet_address.
    """
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    key = (nullifier or "").strip()
    if not key:
        return _unavailable("missing_nullifier")

    try:
        from google.api_core.exceptions import AlreadyExists
        from google.cloud import firestore

        doc_ref = client.collection(COLLECTION).document(key)
        record = {
            "nullifier": key,
            "wallet_address": (wallet_address or "").strip().lower(),
            "scans_granted": TRIAL_SCANS_GRANTED,
            "claimed_at": firestore.SERVER_TIMESTAMP,
        }
        try:
            doc_ref.create(record)  # atomically fails if the doc already exists
        except AlreadyExists:
            existing = doc_ref.get().to_dict() or {}
            return {
                "no_data": False,
                "claimed": False,
                "reason": "already_claimed",
                "wallet_address": existing.get("wallet_address", ""),
            }
        return {"no_data": False, "claimed": True, "scans_granted": TRIAL_SCANS_GRANTED}
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to claim trial for nullifier: {exc}")
        return _unavailable("claim_failed")


def get_claim_status(nullifier: str) -> dict:
    """Check whether this nullifier already claimed a trial, without
    claiming it. Used on app load to restore verified state across
    sessions/reloads without re-running Selfie Check every time - the
    frontend stores the (non-sensitive, non-reversible) nullifier itself
    client-side and re-checks it here rather than re-verifying."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    key = (nullifier or "").strip()
    if not key:
        return _unavailable("missing_nullifier")

    try:
        doc = client.collection(COLLECTION).document(key).get()
        if not doc.exists:
            return {"no_data": False, "claimed": False}
        data = doc.to_dict() or {}
        claimed_at = data.get("claimed_at")
        return {
            "no_data": False,
            "claimed": True,
            "wallet_address": data.get("wallet_address", ""),
            "scans_granted": data.get("scans_granted", TRIAL_SCANS_GRANTED),
            "claimed_at": claimed_at.isoformat() if claimed_at else None,
        }
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to fetch claim status: {exc}")
        return _unavailable("fetch_failed")


def get_claim_status_by_wallet_address(wallet_address: str) -> dict:
    """Same purpose as get_claim_status, but looked up by wallet address
    instead of nullifier - needed because the nullifier is only known on
    whichever device/browser actually completed Selfie Check (it's cached
    in that browser's localStorage as a UX convenience, and localStorage
    never syncs across devices). A person who verified on their phone and
    then opens the same wallet on desktop has no nullifier to check with
    there, but does have the same wallet address, which IS present on the
    claim record (see claim_trial). This does not change what the ledger
    is keyed on - claim_trial's Firestore document ID is still the
    nullifier, which remains the actual Sybil-defense mechanism. This is
    only a read-only convenience lookup for restoring UI state.

    Note: unlike get_claim_status, this can't distinguish "never verified"
    from "verified with a different wallet that was later swapped for this
    one" in the rare case wallet_address was edited after the fact - it
    just reports the first claim record this exact address appears on."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    key = (wallet_address or "").strip().lower()
    if not key:
        return _unavailable("missing_wallet_address")

    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        query = client.collection(COLLECTION).where(filter=FieldFilter("wallet_address", "==", key)).limit(1)
        docs = list(query.stream())
        if not docs:
            return {"no_data": False, "claimed": False}
        data = docs[0].to_dict() or {}
        claimed_at = data.get("claimed_at")
        return {
            "no_data": False,
            "claimed": True,
            "nullifier": data.get("nullifier", ""),
            "wallet_address": data.get("wallet_address", ""),
            "scans_granted": data.get("scans_granted", TRIAL_SCANS_GRANTED),
            "claimed_at": claimed_at.isoformat() if claimed_at else None,
        }
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to fetch claim status by wallet address: {exc}")
        return _unavailable("fetch_failed")
