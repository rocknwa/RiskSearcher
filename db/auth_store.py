"""Firestore-backed challenge/session authentication for RiskSearcher.

The connected smart-account address is never accepted as authentication by
itself.  A user must sign a short-lived nonce with the Circle passkey smart
account, after which the backend issues an opaque bearer session.  All
user-specific endpoints derive identity from that session.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

_client = None
_client_checked = False

CHALLENGE_COLLECTION = "auth_challenges"
SESSION_COLLECTION = "auth_sessions"
CHALLENGE_TTL_MINUTES = 5
SESSION_TTL_DAYS = 7


def _unavailable(reason: str) -> dict:
    return {"no_data": True, "reason": reason}


def reset_client_cache() -> None:
    global _client, _client_checked
    _client, _client_checked = None, False


def _get_client():
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    raw = os.environ.get("FIRESTORE_CREDENTIALS_JSON", "").strip()
    if not raw:
        print("    [AUTH] FIRESTORE_CREDENTIALS_JSON not set; session auth disabled")
        return None
    try:
        from google.cloud import firestore
        from google.oauth2 import service_account

        info = json.loads(raw)
        credentials = service_account.Credentials.from_service_account_info(info)
        _client = firestore.Client(project=info.get("project_id"), credentials=credentials)
    except Exception as exc:
        print(f"    [AUTH] Failed to initialize Firestore: {exc}")
        _client = None
    return _client


def _normalize_address(address: str) -> str:
    return (address or "").strip().lower()


def _token_doc_id(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_challenge(address: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = _normalize_address(address)
    if not wallet.startswith("0x") or len(wallet) != 42:
        return _unavailable("invalid_wallet_address")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=CHALLENGE_TTL_MINUTES)
    challenge_id = secrets.token_urlsafe(24)
    nonce = secrets.token_hex(16)
    message = (
        "RiskSearcher secure session\n"
        f"Wallet: {wallet}\n"
        f"Nonce: {nonce}\n"
        f"Issued at: {now.isoformat()}\n"
        f"Expires at: {expires.isoformat()}\n\n"
        "Sign this message to authenticate. This does not authorize a transfer."
    )
    try:
        client.collection(CHALLENGE_COLLECTION).document(challenge_id).set({
            "wallet_address": wallet,
            "message": message,
            "created_at": now,
            "expires_at": expires,
            "used": False,
        })
        return {
            "no_data": False,
            "challenge_id": challenge_id,
            "message": message,
            "expires_at": expires.isoformat(),
        }
    except Exception as exc:
        print(f"    [AUTH] Failed to issue challenge: {exc}")
        return _unavailable("challenge_create_failed")


def get_challenge(challenge_id: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    try:
        doc = client.collection(CHALLENGE_COLLECTION).document((challenge_id or "").strip()).get()
        if not doc.exists:
            return _unavailable("challenge_not_found")
        data = doc.to_dict() or {}
        expires = data.get("expires_at")
        if data.get("used"):
            return _unavailable("challenge_already_used")
        if not expires or expires <= datetime.now(timezone.utc):
            return _unavailable("challenge_expired")
        return {"no_data": False, **data}
    except Exception as exc:
        print(f"    [AUTH] Failed to fetch challenge: {exc}")
        return _unavailable("challenge_fetch_failed")


def consume_challenge_and_create_session(challenge_id: str, wallet_address: str) -> dict:
    """Atomically consume a verified challenge and create an opaque session."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    challenge_id = (challenge_id or "").strip()
    wallet = _normalize_address(wallet_address)
    token = secrets.token_urlsafe(48)
    token_id = _token_doc_id(token)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)

    try:
        from google.cloud import firestore

        challenge_ref = client.collection(CHALLENGE_COLLECTION).document(challenge_id)
        session_ref = client.collection(SESSION_COLLECTION).document(token_id)
        transaction = client.transaction()

        @firestore.transactional
        def _commit(tx):
            snapshot = challenge_ref.get(transaction=tx)
            if not snapshot.exists:
                return "challenge_not_found"
            data = snapshot.to_dict() or {}
            challenge_expires = data.get("expires_at")
            if data.get("used"):
                return "challenge_already_used"
            if data.get("wallet_address") != wallet:
                return "wallet_mismatch"
            if not challenge_expires or challenge_expires <= datetime.now(timezone.utc):
                return "challenge_expired"
            tx.update(challenge_ref, {"used": True, "used_at": firestore.SERVER_TIMESTAMP})
            tx.create(session_ref, {
                "wallet_address": wallet,
                "created_at": firestore.SERVER_TIMESTAMP,
                "expires_at": expires,
            })
            return "ok"

        status = _commit(transaction)
        if status != "ok":
            return _unavailable(status)
        return {
            "no_data": False,
            "token": token,
            "wallet_address": wallet,
            "expires_at": expires.isoformat(),
        }
    except Exception as exc:
        print(f"    [AUTH] Failed to consume challenge/create session: {exc}")
        return _unavailable("session_create_failed")


def get_session(token: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    if not token:
        return _unavailable("missing_session")
    try:
        doc = client.collection(SESSION_COLLECTION).document(_token_doc_id(token)).get()
        if not doc.exists:
            return _unavailable("invalid_session")
        data = doc.to_dict() or {}
        expires = data.get("expires_at")
        if not expires or expires <= datetime.now(timezone.utc):
            return _unavailable("session_expired")
        return {
            "no_data": False,
            "wallet_address": data.get("wallet_address", ""),
            "expires_at": expires.isoformat(),
        }
    except Exception as exc:
        print(f"    [AUTH] Failed to read session: {exc}")
        return _unavailable("session_fetch_failed")


def revoke_session(token: str) -> None:
    client = _get_client()
    if client is None or not token:
        return
    try:
        client.collection(SESSION_COLLECTION).document(_token_doc_id(token)).delete()
    except Exception as exc:
        print(f"    [AUTH] Failed to revoke session: {exc}")
