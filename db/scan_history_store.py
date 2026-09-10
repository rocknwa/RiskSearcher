"""Firestore-backed scan history, keyed by connected wallet address.

Unlike rpc/arc_provider.py's data/arc_state.json (a local-disk fast-path
cache with Circle itself as the real source of truth), scan history has no
external system that already knows about it - Render's disk is ephemeral,
so without a real database, "history" only ever lived for one session in
the browser's React state and vanished on refresh or redeploy.

Firestore was chosen over a self-hosted DB specifically because Render's
free tier has no persistent disk: this needs to live outside the app's own
ephemeral filesystem entirely, on a permanently-free tier, with no server
to provision or keep alive.

Degrades cleanly to a no_data-shaped dict when FIRESTORE_CREDENTIALS_JSON
isn't configured or a call fails - same discipline as graph_provider.py and
arc_provider.py. A Firestore outage must never break an actual scan; history
saving is best-effort and wrapped in try/except at the call site.

Setup required (see README for the full walkthrough):
  1. Create a Google Cloud project (or reuse one) with Firestore enabled,
     in Native mode, at console.cloud.google.com/firestore.
  2. Create a service account with the "Cloud Datastore User" role, and
     download its JSON key.
  3. Set the ENTIRE contents of that JSON file as FIRESTORE_CREDENTIALS_JSON
     (one env var, the whole file as a string - no file path needed, which
     matters since Render's disk isn't a safe place to keep it anyway).
"""

from __future__ import annotations

import json
import os
from typing import Optional

_client = None
_client_checked = False

COLLECTION = "scan_history"
MAX_RECORDS_PER_USER = 50


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
        print("    [HISTORY] FIRESTORE_CREDENTIALS_JSON not set; scan history disabled")
        return None

    try:
        from google.cloud import firestore
        from google.oauth2 import service_account

        info = json.loads(raw_credentials)
        credentials = service_account.Credentials.from_service_account_info(info)
        _client = firestore.Client(project=info.get("project_id"), credentials=credentials)
    except Exception as exc:
        print(f"    [HISTORY] Failed to initialize Firestore client: {exc}")
        _client = None
    return _client


def save_scan(user_address: str, scan_record: dict) -> dict:
    """Persist one completed scan for this user. Best-effort: failures here
    must never break the analysis flow that already completed successfully -
    callers should call this in a try/except and ignore a no_data result."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    key = (user_address or "").strip().lower()
    if not key:
        return _unavailable("missing_user_address")

    try:
        from google.cloud import firestore

        record = {**scan_record, "user_address": key, "saved_at": firestore.SERVER_TIMESTAMP}
        _, doc_ref = client.collection(COLLECTION).add(record)
        return {"no_data": False, "doc_id": doc_ref.id}
    except Exception as exc:
        print(f"    [HISTORY] Failed to save scan for {key}: {exc}")
        return _unavailable("save_failed")


def get_scan_history(user_address: str, limit: int = MAX_RECORDS_PER_USER) -> dict:
    """Return this user's past scans, most recent first."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")

    key = (user_address or "").strip().lower()
    if not key:
        return _unavailable("missing_user_address")

    try:
        from google.cloud import firestore
        from google.cloud.firestore_v1.base_query import FieldFilter

        query = (
            client.collection(COLLECTION)
            .where(filter=FieldFilter("user_address", "==", key))
            .order_by("saved_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        records = []
        for doc in query.stream():
            data = doc.to_dict()
            data["doc_id"] = doc.id
            saved_at = data.get("saved_at")
            # Firestore timestamps aren't JSON-serializable as-is.
            data["saved_at"] = saved_at.isoformat() if saved_at else None
            records.append(data)
        return {"no_data": False, "records": records}
    except Exception as exc:
        print(f"    [HISTORY] Failed to fetch history for {key}: {exc}")
        return _unavailable("fetch_failed")
