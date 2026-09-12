"""Firestore-backed World ID Selfie Check trial-claim ledger.

The claim is keyed by World ID nullifier (one human / one action), while the
remaining scan allowance lives in ``user_entitlements``.  Claim creation,
three-scan grant, and service-ledger entry are one Firestore transaction so a
retry, concurrent request, or server restart cannot mint the trial twice.
"""

from __future__ import annotations

import hashlib
import json
import os

from db.entitlement_store import ENTITLEMENT_COLLECTION, FREE_TRIAL_SCANS, LEDGER_COLLECTION, normalize_wallet

_client = None
_client_checked = False
COLLECTION = "world_id_trial_claims"
TRIAL_SCANS_GRANTED = FREE_TRIAL_SCANS


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



def _migrate_claim_entitlement(client, claim_ref, claim_data: dict) -> dict:
    """Bring a pre-entitlement World ID claim onto the 3-scan ledger.

    Older RiskSearcher builds wrote only ``world_id_trial_claims`` records and
    advertised 15 scans in the browser.  They did not have a server-side scan
    ledger, so there is no trustworthy historical usage count to preserve.
    The migration therefore grants exactly the current 3-scan allowance when
    no entitlement document exists.  If a newer/partially-migrated entitlement
    already exists, remaining free scans are only clamped downward to 3 and
    are never replenished by repeated status checks.
    """
    wallet = normalize_wallet(claim_data.get("wallet_address", ""))
    nullifier = str(claim_data.get("nullifier", "")).strip()
    if not wallet:
        return _unavailable("legacy_claim_missing_wallet")

    try:
        from google.cloud import firestore

        ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
        ledger_key = nullifier or claim_ref.id
        ledger_id = "world_trial_" + hashlib.sha256(ledger_key.encode("utf-8")).hexdigest()[:40]
        ledger_ref = client.collection(LEDGER_COLLECTION).document(ledger_id)
        transaction = client.transaction()

        @firestore.transactional
        def _migrate(tx):
            ent_snap = ent_ref.get(transaction=tx)
            ent = ent_snap.to_dict() if ent_snap.exists else {}
            already_current = (
                bool((ent or {}).get("world_verified", False))
                and int((ent or {}).get("free_scans_granted", 0) or 0) == FREE_TRIAL_SCANS
                and int((claim_data or {}).get("scans_granted", FREE_TRIAL_SCANS) or FREE_TRIAL_SCANS) == FREE_TRIAL_SCANS
            )
            if already_current:
                return _public_migration_state(ent, wallet, changed=False)

            if ent_snap.exists and bool((ent or {}).get("world_verified", False)):
                # A current entitlement may already have consumed some/all free scans.
                # Never replenish it during migration.
                remaining = max(0, min(FREE_TRIAL_SCANS, int((ent or {}).get("free_scans_remaining", 0) or 0)))
            else:
                # Legacy versions never persisted authoritative consumption. A paid-only
                # entitlement document does not mean this old World ID trial was granted.
                remaining = FREE_TRIAL_SCANS

            tx.set(ent_ref, {
                "wallet_address": wallet,
                "world_verified": True,
                "free_scans_granted": FREE_TRIAL_SCANS,
                "free_scans_remaining": remaining,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            tx.set(claim_ref, {
                "scans_granted": FREE_TRIAL_SCANS,
                "migration_version": 1,
                "migrated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            tx.set(ledger_ref, {
                "wallet_address": wallet,
                "category": "service",
                "operation": "Free Trial Allocation (World ID)",
                "type_icon": "fingerprint",
                "amount": f"+{FREE_TRIAL_SCANS} Scans (Trial)",
                "is_credit": True,
                "is_free": True,
                "tx_hash": ledger_key,
                "settlement": "Verified",
                "created_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            merged = {**(ent or {}), "world_verified": True, "free_scans_granted": FREE_TRIAL_SCANS, "free_scans_remaining": remaining}
            return _public_migration_state(merged, wallet, changed=True)

        return _migrate(transaction)
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to migrate legacy trial claim for {wallet}: {exc}")
        return _unavailable("legacy_claim_migration_failed")


def _public_migration_state(ent: dict, wallet: str, changed: bool) -> dict:
    return {
        "no_data": False,
        "migrated": changed,
        "wallet_address": wallet,
        "world_verified": bool((ent or {}).get("world_verified", False)),
        "free_scans_granted": int((ent or {}).get("free_scans_granted", 0) or 0),
        "free_scans_remaining": int((ent or {}).get("free_scans_remaining", 0) or 0),
    }


def migrate_legacy_claim_for_wallet(wallet_address: str) -> dict:
    """Migrate an older claim for this wallet if one exists.

    Safe to call on every entitlement/status request; after the first migration
    it becomes a read-only no-op and never refills an exhausted free allowance.
    """
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet:
        return _unavailable("missing_wallet_address")
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        docs = list(client.collection(COLLECTION).where(
            filter=FieldFilter("wallet_address", "==", wallet)
        ).limit(1).stream())
        if not docs:
            return {"no_data": False, "migrated": False, "claim_found": False}
        doc = docs[0]
        data = doc.to_dict() or {}
        data.setdefault("nullifier", doc.id)
        result = _migrate_claim_entitlement(client, doc.reference, data)
        if not result.get("no_data"):
            result["claim_found"] = True
        return result
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to locate legacy trial claim for {wallet}: {exc}")
        return _unavailable("legacy_claim_lookup_failed")

def claim_trial(nullifier: str, wallet_address: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    key = (nullifier or "").strip()
    wallet = normalize_wallet(wallet_address)
    if not key:
        return _unavailable("missing_nullifier")
    if not wallet:
        return _unavailable("missing_wallet_address")

    try:
        from google.cloud import firestore

        claim_ref = client.collection(COLLECTION).document(key)
        ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
        ledger_id = "world_trial_" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:40]
        ledger_ref = client.collection(LEDGER_COLLECTION).document(ledger_id)
        transaction = client.transaction()

        @firestore.transactional
        def _claim(tx):
            existing_claim = claim_ref.get(transaction=tx)
            if existing_claim.exists:
                data = existing_claim.to_dict() or {}
                existing_wallet = normalize_wallet(data.get("wallet_address", ""))
                return {
                    "no_data": False,
                    "claimed": False,
                    "reason": "already_claimed",
                    "wallet_address": existing_wallet,
                    "same_wallet": existing_wallet == wallet,
                }

            ent_snap = ent_ref.get(transaction=tx)
            ent = ent_snap.to_dict() if ent_snap.exists else {}
            already_verified = bool((ent or {}).get("world_verified", False))
            scans_remaining = int((ent or {}).get("free_scans_remaining", 0) or 0)
            if not already_verified:
                scans_remaining = FREE_TRIAL_SCANS

            tx.create(claim_ref, {
                "nullifier": key,
                "wallet_address": wallet,
                "scans_granted": FREE_TRIAL_SCANS,
                "claimed_at": firestore.SERVER_TIMESTAMP,
            })
            tx.set(ent_ref, {
                "wallet_address": wallet,
                "world_verified": True,
                "free_scans_granted": FREE_TRIAL_SCANS,
                "free_scans_remaining": scans_remaining,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            tx.set(ledger_ref, {
                "wallet_address": wallet,
                "category": "service",
                "operation": "Free Trial Allocation (World ID)",
                "type_icon": "fingerprint",
                "amount": f"+{FREE_TRIAL_SCANS} Scans (Trial)",
                "is_credit": True,
                "is_free": True,
                "tx_hash": key,
                "settlement": "Verified",
                "created_at": firestore.SERVER_TIMESTAMP,
            })
            return {
                "no_data": False,
                "claimed": True,
                "scans_granted": FREE_TRIAL_SCANS,
                "scans_remaining": scans_remaining,
            }

        return _claim(transaction)
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to claim trial for nullifier: {exc}")
        return _unavailable("claim_failed")


def _status_from_claim(client, data: dict) -> dict:
    wallet = data.get("wallet_address", "")
    remaining = 0
    if wallet:
        ent = client.collection(ENTITLEMENT_COLLECTION).document(wallet).get()
        if ent.exists:
            remaining = int((ent.to_dict() or {}).get("free_scans_remaining", 0) or 0)
    claimed_at = data.get("claimed_at")
    return {
        "no_data": False,
        "claimed": True,
        "wallet_address": wallet,
        "nullifier": data.get("nullifier", ""),
        "scans_granted": FREE_TRIAL_SCANS,
        "scans_remaining": remaining,
        "claimed_at": claimed_at.isoformat() if claimed_at else None,
    }


def get_claim_status(nullifier: str) -> dict:
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
        return _status_from_claim(client, doc.to_dict() or {})
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to fetch claim status: {exc}")
        return _unavailable("fetch_failed")


def get_claim_status_by_wallet_address(wallet_address: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    key = normalize_wallet(wallet_address)
    if not key:
        return _unavailable("missing_wallet_address")
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        docs = list(client.collection(COLLECTION).where(filter=FieldFilter("wallet_address", "==", key)).limit(1).stream())
        if not docs:
            return {"no_data": False, "claimed": False}
        return _status_from_claim(client, docs[0].to_dict() or {})
    except Exception as exc:
        print(f"    [WORLD_ID] Failed to fetch claim status by wallet address: {exc}")
        return _unavailable("fetch_failed")
