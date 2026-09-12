"""Authoritative RiskSearcher scan-credit and service-ledger state.

The browser may display credit counts, but it never decides whether a scan is
allowed.  Every analysis reserves one credit in a Firestore transaction before
work starts.  A successful analysis commits that reservation; a failed analysis
refunds it exactly once.  This closes direct-API, refresh, re-analysis, and
concurrency bypasses.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone

_client = None
_client_checked = False

ENTITLEMENT_COLLECTION = "user_entitlements"
RESERVATION_COLLECTION = "scan_reservations"
PURCHASE_COLLECTION = "scan_pack_purchases"
LEDGER_COLLECTION = "service_ledger"
PAYMENT_INTENT_COLLECTION = "scan_pack_payment_intents"
PURCHASE_INTENT_TTL_SECONDS = 120
PURCHASE_SUBMITTED_TTL_HOURS = 24

FREE_TRIAL_SCANS = 3
PAID_PACK_SCANS = 10
PAID_PACK_PRICE_USDC = 5.0

SUCCESSFUL_PURCHASE_STATES = {"CONFIRMED", "COMPLETE", "COMPLETED"}
FAILED_PURCHASE_STATES = {"FAILED", "CANCELLED", "CANCELED", "DENIED"}


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
        print("    [ENTITLEMENT] FIRESTORE_CREDENTIALS_JSON not set; entitlement ledger disabled")
        return None
    try:
        from google.cloud import firestore
        from google.oauth2 import service_account

        info = json.loads(raw)
        credentials = service_account.Credentials.from_service_account_info(info)
        _client = firestore.Client(project=info.get("project_id"), credentials=credentials)
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to initialize Firestore: {exc}")
        _client = None
    return _client


def normalize_wallet(address: str) -> str:
    return (address or "").strip().lower()


def _public_state(data: dict | None, wallet: str) -> dict:
    data = data or {}
    return {
        "no_data": False,
        "wallet_address": wallet,
        "world_verified": bool(data.get("world_verified", False)),
        "free_scans_remaining": int(data.get("free_scans_remaining", 0) or 0),
        "free_scans_granted": int(data.get("free_scans_granted", FREE_TRIAL_SCANS if data.get("world_verified") else 0) or 0),
        "paid_scans_remaining": int(data.get("paid_scans_remaining", 0) or 0),
        "total_scans_executed": int(data.get("total_scans_executed", 0) or 0),
    }


def get_entitlements(wallet_address: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet:
        return _unavailable("missing_wallet_address")
    try:
        doc = client.collection(ENTITLEMENT_COLLECTION).document(wallet).get()
        return _public_state(doc.to_dict() if doc.exists else {}, wallet)
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to read state for {wallet}: {exc}")
        return _unavailable("entitlement_fetch_failed")


def reserve_scan(wallet_address: str, target_address: str, chain: str) -> dict:
    """Atomically take one free or paid scan credit before analysis begins."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    reservation_id = uuid.uuid4().hex
    try:
        from google.cloud import firestore

        ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
        res_ref = client.collection(RESERVATION_COLLECTION).document(reservation_id)
        transaction = client.transaction()

        @firestore.transactional
        def _reserve(tx):
            snapshot = ent_ref.get(transaction=tx)
            data = snapshot.to_dict() if snapshot.exists else {}
            free = int((data or {}).get("free_scans_remaining", 0) or 0)
            paid = int((data or {}).get("paid_scans_remaining", 0) or 0)
            if free > 0:
                source = "free"
                free -= 1
            elif paid > 0:
                source = "paid"
                paid -= 1
            else:
                return None

            tx.set(ent_ref, {
                **(data or {}),
                "wallet_address": wallet,
                "free_scans_remaining": free,
                "paid_scans_remaining": paid,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            tx.create(res_ref, {
                "wallet_address": wallet,
                "target_address": (target_address or "").strip().lower(),
                "chain": chain,
                "credit_source": source,
                "status": "reserved",
                "created_at": firestore.SERVER_TIMESTAMP,
            })
            return source, free, paid, int((data or {}).get("total_scans_executed", 0) or 0), bool((data or {}).get("world_verified", False)), int((data or {}).get("free_scans_granted", FREE_TRIAL_SCANS if (data or {}).get("world_verified") else 0) or 0)

        reserved = _reserve(transaction)
        if reserved is None:
            state = get_entitlements(wallet)
            return {"no_data": False, "allowed": False, "reason": "no_scan_credits", "entitlement": state}
        source, free, paid, total, verified, granted = reserved
        return {
            "no_data": False,
            "allowed": True,
            "reservation_id": reservation_id,
            "credit_source": source,
            "entitlement": {
                "no_data": False,
                "wallet_address": wallet,
                "world_verified": verified,
                "free_scans_remaining": free,
                "free_scans_granted": granted,
                "paid_scans_remaining": paid,
                "total_scans_executed": total,
            },
        }
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to reserve scan for {wallet}: {exc}")
        return _unavailable("scan_reservation_failed")


def commit_scan(reservation_id: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    try:
        from google.cloud import firestore

        res_ref = client.collection(RESERVATION_COLLECTION).document(reservation_id)
        ledger_ref = client.collection(LEDGER_COLLECTION).document(f"scan_{reservation_id}")
        transaction = client.transaction()

        @firestore.transactional
        def _commit(tx):
            res = res_ref.get(transaction=tx)
            if not res.exists:
                return "missing", None
            r = res.to_dict() or {}
            wallet = r.get("wallet_address", "")
            if r.get("status") == "completed":
                ent = client.collection(ENTITLEMENT_COLLECTION).document(wallet).get(transaction=tx)
                return "already_completed", _public_state(ent.to_dict() if ent.exists else {}, wallet)
            if r.get("status") != "reserved":
                return r.get("status", "invalid"), None

            ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
            ent_snap = ent_ref.get(transaction=tx)
            ent = ent_snap.to_dict() if ent_snap.exists else {}
            total = int((ent or {}).get("total_scans_executed", 0) or 0) + 1
            tx.set(ent_ref, {"total_scans_executed": total, "updated_at": firestore.SERVER_TIMESTAMP}, merge=True)
            tx.update(res_ref, {"status": "completed", "completed_at": firestore.SERVER_TIMESTAMP})
            source = r.get("credit_source", "paid")
            tx.set(ledger_ref, {
                "wallet_address": wallet,
                "category": "service",
                "operation": "Contract risk analysis",
                "type_icon": "security",
                "amount": "-1 Trial Scan" if source == "free" else "-1 Paid Scan",
                "is_credit": False,
                "is_free": source == "free",
                "tx_hash": reservation_id,
                "settlement": "Completed",
                "created_at": firestore.SERVER_TIMESTAMP,
            })
            state = {**(ent or {}), "total_scans_executed": total}
            return "completed", _public_state(state, wallet)

        status, state = _commit(transaction)
        return {"no_data": False, "status": status, "entitlement": state}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to commit scan {reservation_id}: {exc}")
        return _unavailable("scan_commit_failed")


def refund_scan(reservation_id: str) -> dict:
    """Restore a reserved credit once if analysis itself fails."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    try:
        from google.cloud import firestore

        res_ref = client.collection(RESERVATION_COLLECTION).document(reservation_id)
        transaction = client.transaction()

        @firestore.transactional
        def _refund(tx):
            res = res_ref.get(transaction=tx)
            if not res.exists:
                return "missing"
            r = res.to_dict() or {}
            if r.get("status") != "reserved":
                return r.get("status", "invalid")
            wallet = r.get("wallet_address", "")
            ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
            ent_snap = ent_ref.get(transaction=tx)
            ent = ent_snap.to_dict() if ent_snap.exists else {}
            source = r.get("credit_source")
            field = "free_scans_remaining" if source == "free" else "paid_scans_remaining"
            restored = int((ent or {}).get(field, 0) or 0) + 1
            tx.set(ent_ref, {field: restored, "updated_at": firestore.SERVER_TIMESTAMP}, merge=True)
            tx.update(res_ref, {"status": "refunded", "refunded_at": firestore.SERVER_TIMESTAMP})
            return "refunded"

        return {"no_data": False, "status": _refund(transaction)}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to refund scan {reservation_id}: {exc}")
        return _unavailable("scan_refund_failed")


def begin_purchase_intent(wallet_address: str) -> dict:
    """Atomically claim the right to start one Circle scan-pack transfer.

    This closes double-click / concurrent-request races around the external
    Circle transfer.  The short lease can be retried if a request dies before
    any transaction id is recorded.  Once a Circle transaction id is attached,
    the intent is retained much longer so a refresh/restart can recover it.
    """
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet:
        return _unavailable("missing_wallet_address")
    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=PURCHASE_INTENT_TTL_SECONDS)
    try:
        from google.cloud import firestore

        ref = client.collection(PAYMENT_INTENT_COLLECTION).document(wallet)
        transaction = client.transaction()

        @firestore.transactional
        def _claim(tx):
            snap = ref.get(transaction=tx)
            data = snap.to_dict() if snap.exists else {}
            current_expires = (data or {}).get("expires_at")
            has_live_intent = bool(current_expires and current_expires > now)
            if has_live_intent:
                return {"acquired": False, **(data or {})}
            tx.set(ref, {
                "wallet_address": wallet,
                "intent_token": token,
                "status": "starting",
                "transaction_id": "",
                "circle_status": "INITIATING",
                "created_at": now,
                "expires_at": expires,
            })
            return {
                "acquired": True,
                "wallet_address": wallet,
                "intent_token": token,
                "status": "starting",
                "transaction_id": "",
                "circle_status": "INITIATING",
                "expires_at": expires,
            }

        return {"no_data": False, **_claim(transaction)}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to claim payment intent for {wallet}: {exc}")
        return _unavailable("purchase_intent_failed")


def attach_purchase_transaction(wallet_address: str, intent_token: str, transaction_id: str, circle_status: str) -> dict:
    """Persist the Circle transaction id onto the active payment intent."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet or not intent_token or not transaction_id:
        return _unavailable("invalid_purchase_intent")
    try:
        from google.cloud import firestore

        ref = client.collection(PAYMENT_INTENT_COLLECTION).document(wallet)
        transaction = client.transaction()
        expires = datetime.now(timezone.utc) + timedelta(hours=PURCHASE_SUBMITTED_TTL_HOURS)

        @firestore.transactional
        def _attach(tx):
            snap = ref.get(transaction=tx)
            if not snap.exists:
                return "intent_not_found"
            data = snap.to_dict() or {}
            if data.get("intent_token") != intent_token:
                return "intent_token_mismatch"
            tx.update(ref, {
                "status": "submitted",
                "transaction_id": transaction_id,
                "circle_status": str(circle_status or "INITIATED").upper(),
                "expires_at": expires,
                "updated_at": firestore.SERVER_TIMESTAMP,
            })
            return "attached"

        status = _attach(transaction)
        if status != "attached":
            return _unavailable(status)
        return {"no_data": False, "status": status, "transaction_id": transaction_id}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to attach payment transaction for {wallet}: {exc}")
        return _unavailable("purchase_intent_attach_failed")


def get_purchase_intent(wallet_address: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet:
        return _unavailable("missing_wallet_address")
    try:
        doc = client.collection(PAYMENT_INTENT_COLLECTION).document(wallet).get()
        if not doc.exists:
            return {"no_data": False, "intent": None}
        data = doc.to_dict() or {}
        expires = data.get("expires_at")
        if expires and expires <= datetime.now(timezone.utc):
            return {"no_data": False, "intent": None}
        return {"no_data": False, "intent": data}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to read payment intent for {wallet}: {exc}")
        return _unavailable("purchase_intent_fetch_failed")


def clear_purchase_intent(wallet_address: str, intent_token: str) -> None:
    """Best-effort delete of the caller's own payment intent."""
    client = _get_client()
    if client is None:
        return
    wallet = normalize_wallet(wallet_address)
    try:
        ref = client.collection(PAYMENT_INTENT_COLLECTION).document(wallet)
        snap = ref.get()
        if snap.exists and (snap.to_dict() or {}).get("intent_token") == intent_token:
            ref.delete()
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to clear payment intent for {wallet}: {exc}")


def create_pending_purchase(wallet_address: str, transaction_id: str, circle_status: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not transaction_id:
        return _unavailable("missing_transaction_id")
    try:
        from google.cloud import firestore

        ref = client.collection(PURCHASE_COLLECTION).document(transaction_id)
        existing = ref.get()
        if existing.exists:
            data = existing.to_dict() or {}
            if data.get("wallet_address") != wallet:
                return _unavailable("transaction_owner_mismatch")
            return {"no_data": False, **data}
        ref.create({
            "wallet_address": wallet,
            "price_usdc": PAID_PACK_PRICE_USDC,
            "scans": PAID_PACK_SCANS,
            "circle_status": circle_status,
            "grant_applied": False,
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        return {"no_data": False, "wallet_address": wallet, "transaction_id": transaction_id, "circle_status": circle_status, "grant_applied": False}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to save purchase {transaction_id}: {exc}")
        return _unavailable("purchase_create_failed")



def get_open_purchase_for_wallet(wallet_address: str, limit: int = 25) -> dict:
    """Return the newest ungranted, non-terminal purchase for a wallet.

    This is intentionally queried only by wallet_address and filtered in
    Python, avoiding a Firestore composite-index dependency.  It lets the API
    resume a pending Circle payment after a modal close, refresh, or server
    restart instead of starting a second $5 transfer.
    """
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    if not wallet:
        return _unavailable("missing_wallet_address")
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        docs = client.collection(PURCHASE_COLLECTION).where(
            filter=FieldFilter("wallet_address", "==", wallet)
        ).limit(max(1, min(int(limit), 50))).stream()
        candidates = []
        for doc in docs:
            data = doc.to_dict() or {}
            status = str(data.get("circle_status", "PENDING")).upper()
            if data.get("grant_applied") or status in FAILED_PURCHASE_STATES:
                continue
            created = data.get("created_at")
            sort_value = created.timestamp() if hasattr(created, "timestamp") else 0
            candidates.append((sort_value, doc.id, data))
        if not candidates:
            return {"no_data": False, "purchase": None}
        _, transaction_id, data = max(candidates, key=lambda item: item[0])
        return {
            "no_data": False,
            "purchase": {"transaction_id": transaction_id, **data},
        }
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to find pending purchase for {wallet}: {exc}")
        return _unavailable("purchase_lookup_failed")

def get_purchase(transaction_id: str) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    try:
        doc = client.collection(PURCHASE_COLLECTION).document(transaction_id).get()
        if not doc.exists:
            return _unavailable("purchase_not_found")
        return {"no_data": False, "transaction_id": transaction_id, **(doc.to_dict() or {})}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to read purchase {transaction_id}: {exc}")
        return _unavailable("purchase_fetch_failed")


def update_purchase_status(transaction_id: str, status: str, tx_hash: str = "") -> None:
    client = _get_client()
    if client is None:
        return
    try:
        from google.cloud import firestore
        client.collection(PURCHASE_COLLECTION).document(transaction_id).set({
            "circle_status": status,
            "tx_hash": tx_hash,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }, merge=True)
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to update purchase {transaction_id}: {exc}")


def grant_confirmed_purchase(wallet_address: str, transaction_id: str, circle_status: str, tx_hash: str = "") -> dict:
    """Idempotently add 10 paid scans after Circle reports confirmation/finality."""
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    try:
        from google.cloud import firestore

        purchase_ref = client.collection(PURCHASE_COLLECTION).document(transaction_id)
        ent_ref = client.collection(ENTITLEMENT_COLLECTION).document(wallet)
        ledger_ref = client.collection(LEDGER_COLLECTION).document(f"purchase_{transaction_id}")
        transaction = client.transaction()

        @firestore.transactional
        def _grant(tx):
            purchase_snap = purchase_ref.get(transaction=tx)
            if not purchase_snap.exists:
                return "purchase_not_found", None
            purchase = purchase_snap.to_dict() or {}
            if purchase.get("wallet_address") != wallet:
                return "transaction_owner_mismatch", None
            ent_snap = ent_ref.get(transaction=tx)
            ent = ent_snap.to_dict() if ent_snap.exists else {}
            if purchase.get("grant_applied"):
                return "already_granted", _public_state(ent, wallet)

            paid = int((ent or {}).get("paid_scans_remaining", 0) or 0) + PAID_PACK_SCANS
            tx.set(ent_ref, {
                "wallet_address": wallet,
                "paid_scans_remaining": paid,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            tx.update(purchase_ref, {
                "grant_applied": True,
                "circle_status": circle_status,
                "tx_hash": tx_hash,
                "granted_at": firestore.SERVER_TIMESTAMP,
            })
            tx.set(ledger_ref, {
                "wallet_address": wallet,
                "category": "service",
                "operation": "10-scan pack purchase (Arc Testnet)",
                "type_icon": "stars",
                "amount": f"+{PAID_PACK_SCANS} Paid Scans ($5 testnet USDC)",
                "is_credit": True,
                "is_free": False,
                "tx_hash": tx_hash or transaction_id,
                "settlement": "Confirmed",
                "created_at": firestore.SERVER_TIMESTAMP,
            })
            return "granted", _public_state({**(ent or {}), "paid_scans_remaining": paid}, wallet)

        status, state = _grant(transaction)
        if status in {"purchase_not_found", "transaction_owner_mismatch"}:
            return _unavailable(status)
        return {"no_data": False, "status": status, "entitlement": state}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to grant purchase {transaction_id}: {exc}")
        return _unavailable("purchase_grant_failed")


def get_service_ledger(wallet_address: str, limit: int = 100) -> dict:
    client = _get_client()
    if client is None:
        return _unavailable("firestore_not_configured")
    wallet = normalize_wallet(wallet_address)
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        # No order_by here: avoiding a composite-index deployment dependency.
        docs = client.collection(LEDGER_COLLECTION).where(filter=FieldFilter("wallet_address", "==", wallet)).limit(limit).stream()
        rows = []
        for doc in docs:
            data = doc.to_dict() or {}
            created = data.get("created_at")
            rows.append({
                "id": doc.id,
                "timestamp": created.isoformat() if created else None,
                "operation": data.get("operation", "RiskSearcher service activity"),
                "type_icon": data.get("type_icon", "receipt_long"),
                "amount": data.get("amount", ""),
                "is_credit": bool(data.get("is_credit", False)),
                "is_free": bool(data.get("is_free", False)),
                "category": "service",
                "tx_hash": data.get("tx_hash", ""),
                "settlement": data.get("settlement", "Completed"),
            })
        rows.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
        return {"no_data": False, "records": rows}
    except Exception as exc:
        print(f"    [ENTITLEMENT] Failed to fetch service ledger: {exc}")
        return _unavailable("ledger_fetch_failed")
