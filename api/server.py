"""Persistent FastAPI + SSE server for RiskSearcher.

Security boundary: the browser never authorizes a scan by itself.  A Circle
passkey smart account signs a short-lived challenge, the backend issues an
opaque session, and every user-specific endpoint derives the wallet identity
from that session.  Firestore is authoritative for World ID trial credits,
paid scan credits, scan reservations, and service-ledger history.
"""

from __future__ import annotations

import json
import os
import queue
import threading
from typing import Generator

from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.analyzer import analyze
from db import auth_store, entitlement_store, scan_history_store, world_id_store
from rpc import arc_provider, smart_account_auth, world_id_provider

app = FastAPI(title="RiskSearcher API")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://risksearcher.vercel.app",
]
VERCEL_PREVIEW_ORIGIN_REGEX = r"^https://risksearcher-[a-z0-9-]+\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=VERCEL_PREVIEW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return token


def require_session(authorization: str | None = Header(default=None)) -> str:
    token = _bearer_token(authorization)
    session = auth_store.get_session(token)
    if session.get("no_data"):
        raise HTTPException(status_code=401, detail="Session expired or invalid. Sign in with your passkey again.")
    wallet = session.get("wallet_address", "")
    if not wallet:
        raise HTTPException(status_code=401, detail="Invalid session")
    return wallet


# ---------------------------------------------------------------------------
# Passkey smart-account authentication
# ---------------------------------------------------------------------------

class AuthChallengeRequest(BaseModel):
    address: str


class AuthVerifyRequest(BaseModel):
    address: str
    challenge_id: str
    signature: str


@app.post("/auth/challenge")
def auth_challenge_endpoint(payload: AuthChallengeRequest = Body(...)):
    result = auth_store.issue_challenge(payload.address)
    if result.get("no_data"):
        raise HTTPException(status_code=503 if result.get("reason") == "firestore_not_configured" else 400, detail=result.get("reason", "Unable to issue challenge"))
    return result


@app.post("/auth/verify")
def auth_verify_endpoint(payload: AuthVerifyRequest = Body(...)):
    challenge = auth_store.get_challenge(payload.challenge_id)
    if challenge.get("no_data"):
        raise HTTPException(status_code=401, detail=challenge.get("reason", "Invalid authentication challenge"))
    if challenge.get("wallet_address") != payload.address.strip().lower():
        raise HTTPException(status_code=401, detail="Wallet does not match authentication challenge")
    message = challenge.get("message", "")
    if not smart_account_auth.verify_message_signature(payload.address, message, payload.signature):
        raise HTTPException(status_code=401, detail="Passkey smart-account signature could not be verified")
    session = auth_store.consume_challenge_and_create_session(payload.challenge_id, payload.address)
    if session.get("no_data"):
        raise HTTPException(status_code=401, detail=session.get("reason", "Could not create session"))
    return session


@app.post("/auth/logout")
def auth_logout_endpoint(authorization: str | None = Header(default=None)):
    token = _bearer_token(authorization)
    auth_store.revoke_session(token)
    return {"ok": True}


@app.get("/auth/session")
def auth_session_endpoint(wallet_address: str = Depends(require_session)):
    """Restore a still-valid browser session without re-running passkey auth."""
    return {"authenticated": True, "wallet_address": wallet_address}


# ---------------------------------------------------------------------------
# Authoritative entitlement + analysis flow
# ---------------------------------------------------------------------------

def _run_analysis_stream(
    address: str,
    chain: str,
    wallet_address: str,
    reservation_id: str,
) -> Generator[str, None, None]:
    q: "queue.Queue[tuple[str, dict] | None]" = queue.Queue()

    def on_progress(msg: str) -> None:
        q.put(("progress", {"message": msg}))

    def worker() -> None:
        try:
            result = analyze(address, chain=chain, on_progress=on_progress)
            result_payload = {
                "verdict": result.verdict,
                "severity": result.severity,
                "score": result.score,
                "rule_score": getattr(result, "rule_score", None),
                "score_source": getattr(result, "score_source", None),
                "verdict_source": getattr(result, "verdict_source", None),
                "final_reason": getattr(result, "final_reason", ""),
                "parameters": getattr(result, "parameters", None),
                "breakdown": result.breakdown,
                "graph_evidence": getattr(result, "graph_evidence", None),
            }

            try:
                scan_history_store.save_scan(wallet_address, {
                    "contract_address": address,
                    "chain": chain,
                    **result_payload,
                })
            except Exception as exc:
                print(f"    [HISTORY] Unexpected error saving scan: {exc}")

            committed = entitlement_store.commit_scan(reservation_id)
            if not committed.get("no_data") and committed.get("entitlement"):
                result_payload["entitlement"] = committed["entitlement"]
            else:
                # The analysis succeeded and the credit was already reserved.
                # Do not pretend it was refunded simply because a post-analysis
                # ledger update had a transient problem.
                result_payload["entitlement"] = entitlement_store.get_entitlements(wallet_address)

            q.put(("result", result_payload))
        except Exception as exc:
            entitlement_store.refund_scan(reservation_id)
            q.put(("error", {"message": str(exc)}))
        finally:
            q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    while True:
        item = q.get()
        if item is None:
            break
        event_type, data = item
        yield _sse_event(event_type, data)


@app.get("/entitlements")
def entitlements_endpoint(wallet_address: str = Depends(require_session)):
    # Seamlessly migrate any claim created by the older 15-scan/frontend-only
    # build onto the current authoritative 3-scan ledger. This is idempotent
    # and never refills a current exhausted allowance.
    world_id_store.migrate_legacy_claim_for_wallet(wallet_address)
    state = entitlement_store.get_entitlements(wallet_address)
    if state.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Entitlement ledger unavailable: {state.get('reason')}")
    return state


@app.get("/analyze")
def analyze_endpoint(
    address: str = Query(..., description="Contract address to analyze"),
    chain: str = Query("ethereum", description="Chain name"),
    wallet_address: str = Depends(require_session),
):
    world_id_store.migrate_legacy_claim_for_wallet(wallet_address)
    reservation = entitlement_store.reserve_scan(wallet_address, address, chain)
    if reservation.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Entitlement ledger unavailable: {reservation.get('reason')}")
    if not reservation.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "SCAN_CREDIT_REQUIRED",
                "message": "Verify humanity for 3 free scans or buy 10 scans for $5 testnet USDC.",
                "entitlement": reservation.get("entitlement"),
            },
        )

    return StreamingResponse(
        _run_analysis_stream(address, chain, wallet_address, reservation["reservation_id"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/history")
def history_endpoint(wallet_address: str = Depends(require_session)):
    return scan_history_store.get_scan_history(wallet_address)


# ---------------------------------------------------------------------------
# Arc Testnet wallet + paid 10-scan packs
# ---------------------------------------------------------------------------

def _wallet_and_balance(user_address: str) -> dict:
    wallet = arc_provider.get_or_create_wallet(user_address)
    if wallet.get("no_data"):
        return wallet
    balance = arc_provider.get_wallet_balance(wallet["wallet_id"])
    return {
        "no_data": balance.get("no_data", False),
        "reason": balance.get("reason", ""),
        "deposit_address": wallet["deposit_address"],
        "usdc_balance": balance.get("usdc_balance"),
    }


@app.get("/arc/wallet")
def arc_wallet_endpoint(wallet_address: str = Depends(require_session)):
    return _wallet_and_balance(wallet_address)


@app.post("/arc/withdraw")
def arc_withdraw_endpoint(wallet_address: str = Depends(require_session)):
    # Product decision for the testnet release: there is no off-ramp or bridge
    # yet. Keeping this disabled server-side prevents an old frontend from
    # accidentally exposing the former misleading "withdraw" flow.
    raise HTTPException(status_code=501, detail="Off-ramp / withdrawal is coming soon. Use the Arc Testnet faucet to fund your wallet for now.")


@app.post("/arc/send")
def arc_send_endpoint(payload: dict = Body(...), wallet_address: str = Depends(require_session)):
    """Optional direct Arc-Testnet transfer. This is NOT an off-ramp/bridge."""
    destination = str(payload.get("destination", "")).strip()
    try:
        amount = float(payload.get("amount", 0))
    except (TypeError, ValueError):
        amount = 0
    wallet = arc_provider.get_or_create_wallet(wallet_address)
    if wallet.get("no_data"):
        raise HTTPException(status_code=400, detail=f"Arc wallet unavailable: {wallet.get('reason')}")
    result = arc_provider.send_usdc(wallet["wallet_id"], destination, amount)
    if result.get("no_data"):
        raise HTTPException(status_code=400, detail=f"Arc transfer failed: {result.get('reason')}")
    return result


@app.post("/arc/subscribe")
def arc_subscribe_endpoint(wallet_address: str = Depends(require_session)):
    """Purchase one fixed testnet scan pack: $5 USDC -> 10 scan credits.

    The backend first claims a short Firestore payment-intent lease, so two
    concurrent requests cannot both submit Circle transfers.  A submitted
    transaction is persisted before credits are considered and is resumed
    after refresh/restart instead of charging again.
    """
    treasury_address = os.environ.get("ARC_TREASURY_ADDRESS", "").strip()
    if not treasury_address:
        raise HTTPException(status_code=503, detail="ARC_TREASURY_ADDRESS is not configured on the server")

    # First resume a normal durable purchase if one already exists.
    open_purchase = entitlement_store.get_open_purchase_for_wallet(wallet_address)
    if open_purchase.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Payment ledger unavailable: {open_purchase.get('reason')}")
    existing = open_purchase.get("purchase")
    if existing:
        return _reconcile_purchase(wallet_address, existing["transaction_id"], allow_not_found=False, reused_pending=True)

    # Recover an external Circle transfer whose intent survived a restart but
    # whose scan_pack_purchases row had not yet been created.
    intent_state = entitlement_store.get_purchase_intent(wallet_address)
    if intent_state.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Payment intent ledger unavailable: {intent_state.get('reason')}")
    intent = intent_state.get("intent")
    if intent:
        intent_tx = str(intent.get("transaction_id", "") or "")
        if intent_tx:
            restored = entitlement_store.create_pending_purchase(
                wallet_address, intent_tx, str(intent.get("circle_status", "PENDING")).upper()
            )
            if restored.get("no_data"):
                raise HTTPException(status_code=503, detail=f"Could not restore pending payment: {restored.get('reason')}")
            # The durable purchase row now owns recovery. The intent is redundant
            # and can be cleared even while Circle is still pending.
            entitlement_store.clear_purchase_intent(wallet_address, str(intent.get("intent_token", "")))
            return _reconcile_purchase(wallet_address, intent_tx, reused_pending=True)
        raise HTTPException(status_code=409, detail="A scan-pack payment is already being initiated. Wait a moment and check its status instead of paying again.")

    claim = entitlement_store.begin_purchase_intent(wallet_address)
    if claim.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Payment intent unavailable: {claim.get('reason')}")
    if not claim.get("acquired"):
        intent_tx = str(claim.get("transaction_id", "") or "")
        if intent_tx:
            restored = entitlement_store.create_pending_purchase(
                wallet_address, intent_tx, str(claim.get("circle_status", "PENDING")).upper()
            )
            if restored.get("no_data"):
                raise HTTPException(status_code=503, detail=f"Could not restore pending payment: {restored.get('reason')}")
            entitlement_store.clear_purchase_intent(wallet_address, str(claim.get("intent_token", "")))
            return _reconcile_purchase(wallet_address, intent_tx, reused_pending=True)
        raise HTTPException(status_code=409, detail="A scan-pack payment is already being initiated. Wait a moment and retry status.")

    intent_token = str(claim.get("intent_token", ""))
    wallet = arc_provider.get_or_create_wallet(wallet_address)
    if wallet.get("no_data"):
        entitlement_store.clear_purchase_intent(wallet_address, intent_token)
        raise HTTPException(status_code=400, detail=f"Arc wallet unavailable: {wallet.get('reason')}")

    transfer = arc_provider.send_usdc(
        wallet["wallet_id"],
        treasury_address,
        entitlement_store.PAID_PACK_PRICE_USDC,
    )
    if transfer.get("no_data"):
        entitlement_store.clear_purchase_intent(wallet_address, intent_token)
        raise HTTPException(status_code=400, detail=f"Payment transfer failed: {transfer.get('reason')}")
    transaction_id = transfer.get("transaction_id", "")
    if not transaction_id:
        # Keep the short intent lease instead of permitting an immediate
        # duplicate transfer when Circle gave us no recoverable transaction id.
        raise HTTPException(status_code=502, detail="Circle accepted the transfer request but returned no transaction ID. Do not retry immediately.")

    attached = entitlement_store.attach_purchase_transaction(
        wallet_address, intent_token, transaction_id, str(transfer.get("status", "INITIATED")).upper()
    )
    purchase = entitlement_store.create_pending_purchase(
        wallet_address,
        transaction_id,
        str(transfer.get("status", "INITIATED")).upper(),
    )
    if purchase.get("no_data"):
        # If attach succeeded the submitted transaction remains recoverable from
        # the payment intent for 24 hours. Either way expose the tx id and never
        # tell the browser to auto-submit a replacement payment.
        raise HTTPException(
            status_code=503,
            detail={
                "code": "PAYMENT_PERSIST_FAILED",
                "message": "Circle transfer was submitted but RiskSearcher could not persist the purchase. Do not retry payment automatically.",
                "transaction_id": transaction_id,
                "intent_recoverable": not attached.get("no_data"),
            },
        )

    entitlement_store.clear_purchase_intent(wallet_address, intent_token)
    return {
        "no_data": False,
        "transaction_id": transaction_id,
        "status": str(transfer.get("status", "INITIATED")).upper(),
        "price_usdc": entitlement_store.PAID_PACK_PRICE_USDC,
        "scans": entitlement_store.PAID_PACK_SCANS,
        "credits_granted": False,
        "reused_pending": False,
    }


def _reconcile_purchase(
    wallet_address: str,
    transaction_id: str,
    *,
    allow_not_found: bool = False,
    reused_pending: bool = False,
) -> dict:
    purchase = entitlement_store.get_purchase(transaction_id)
    if purchase.get("no_data"):
        if allow_not_found:
            return {"no_data": False, "pending_purchase": None}
        raise HTTPException(status_code=404, detail=purchase.get("reason", "Purchase not found"))
    if purchase.get("wallet_address") != wallet_address:
        raise HTTPException(status_code=403, detail="This payment does not belong to the authenticated wallet")

    # If a previous poll already granted credits, return the durable state
    # immediately without depending on Circle being reachable again.
    if purchase.get("grant_applied"):
        return {
            "no_data": False,
            "transaction_id": transaction_id,
            "status": str(purchase.get("circle_status", "CONFIRMED")).upper(),
            "tx_hash": purchase.get("tx_hash", ""),
            "credits_granted": True,
            "reused_pending": reused_pending,
            "entitlement": entitlement_store.get_entitlements(wallet_address),
        }

    circle_tx = arc_provider.get_transaction(transaction_id)
    if circle_tx.get("no_data"):
        # Durable last-known state is safer than inventing success.  The
        # frontend can resume this same transaction later instead of paying twice.
        return {
            "no_data": False,
            "transaction_id": transaction_id,
            "status": str(purchase.get("circle_status", "PENDING")).upper(),
            "credits_granted": False,
            "reused_pending": reused_pending,
            "reason": circle_tx.get("reason", "status_unavailable"),
            "entitlement": entitlement_store.get_entitlements(wallet_address),
        }

    status = str(circle_tx.get("status", "UNKNOWN")).upper()
    tx_hash = circle_tx.get("tx_hash", "")
    entitlement_store.update_purchase_status(transaction_id, status, tx_hash)
    if status in entitlement_store.SUCCESSFUL_PURCHASE_STATES:
        granted = entitlement_store.grant_confirmed_purchase(wallet_address, transaction_id, status, tx_hash)
        if granted.get("no_data"):
            raise HTTPException(status_code=503, detail=f"Payment confirmed but credit grant failed: {granted.get('reason')}")
        return {
            "no_data": False,
            "transaction_id": transaction_id,
            "status": status,
            "tx_hash": tx_hash,
            "credits_granted": True,
            "reused_pending": reused_pending,
            "entitlement": granted.get("entitlement"),
        }

    return {
        "no_data": False,
        "transaction_id": transaction_id,
        "status": status,
        "tx_hash": tx_hash,
        "credits_granted": False,
        "reused_pending": reused_pending,
        "entitlement": entitlement_store.get_entitlements(wallet_address),
    }


@app.get("/arc/subscription-status")
def arc_subscription_status_endpoint(
    transaction_id: str = Query(...),
    wallet_address: str = Depends(require_session),
):
    return _reconcile_purchase(wallet_address, transaction_id)


@app.get("/arc/pending-subscription")
def arc_pending_subscription_endpoint(wallet_address: str = Depends(require_session)):
    """Find/recover/reconcile the user's newest outstanding payment, if any."""
    open_purchase = entitlement_store.get_open_purchase_for_wallet(wallet_address)
    if open_purchase.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Payment ledger unavailable: {open_purchase.get('reason')}")
    purchase = open_purchase.get("purchase")
    if purchase:
        reconciled = _reconcile_purchase(wallet_address, purchase["transaction_id"], reused_pending=True)
        return {"no_data": False, "pending_purchase": reconciled}

    intent_state = entitlement_store.get_purchase_intent(wallet_address)
    if intent_state.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Payment intent ledger unavailable: {intent_state.get('reason')}")
    intent = intent_state.get("intent")
    if not intent:
        return {"no_data": False, "pending_purchase": None}
    transaction_id = str(intent.get("transaction_id", "") or "")
    if not transaction_id:
        return {
            "no_data": False,
            "pending_purchase": {
                "status": "INITIATING",
                "credits_granted": False,
                "reason": "payment_initiation_in_progress",
            },
        }

    restored = entitlement_store.create_pending_purchase(
        wallet_address, transaction_id, str(intent.get("circle_status", "PENDING")).upper()
    )
    if restored.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Could not restore pending payment: {restored.get('reason')}")
    entitlement_store.clear_purchase_intent(wallet_address, str(intent.get("intent_token", "")))
    reconciled = _reconcile_purchase(wallet_address, transaction_id, reused_pending=True)
    return {"no_data": False, "pending_purchase": reconciled}


# ---------------------------------------------------------------------------
# Real per-user ledger (service entries + Circle wallet activity)
# ---------------------------------------------------------------------------

def _circle_ledger_rows(wallet_address: str) -> list[dict]:
    wallet = arc_provider.get_or_create_wallet(wallet_address)
    if wallet.get("no_data"):
        return []
    history = arc_provider.list_wallet_transactions(wallet["wallet_id"])
    if history.get("no_data"):
        return []
    own_address = str(wallet.get("deposit_address", "")).lower()
    rows: list[dict] = []
    for tx in history.get("transactions", []):
        if not isinstance(tx, dict):
            continue
        amounts = tx.get("amounts") or []
        if isinstance(amounts, str):
            amounts = [amounts]
        amount = amounts[0] if amounts else tx.get("amount", "")
        destination = str(tx.get("destinationAddress") or tx.get("destination_address") or "").lower()
        source = str(tx.get("sourceAddress") or tx.get("source_address") or "").lower()
        incoming = bool(own_address and destination == own_address and source != own_address)
        operation = "Arc Testnet deposit" if incoming else "Arc Testnet wallet transfer"
        state = str(tx.get("state") or tx.get("status") or "Pending").title()
        created = tx.get("createDate") or tx.get("create_date") or tx.get("updateDate") or tx.get("update_date")
        tx_id = str(tx.get("id") or "")
        tx_hash = str(tx.get("txHash") or tx.get("tx_hash") or tx_id)
        amount_text = f"{'+' if incoming else '-'}{amount} USDC" if amount not in (None, "") else "USDC transfer"
        rows.append({
            "id": f"circle-{tx_id or tx_hash}",
            "timestamp": created,
            "operation": operation,
            "typeIcon": "south_west" if incoming else "north_east",
            "amount": amount_text,
            "isCredit": incoming,
            "isFree": False,
            "category": "wallet",
            "txHash": tx_hash,
            "settlement": state,
        })
    return rows


@app.get("/ledger")
def ledger_endpoint(wallet_address: str = Depends(require_session)):
    service = entitlement_store.get_service_ledger(wallet_address)
    raw_service_rows = [] if service.get("no_data") else service.get("records", [])
    service_rows = [
        {
            "id": row.get("id", ""),
            "timestamp": row.get("timestamp"),
            "operation": row.get("operation", "RiskSearcher service activity"),
            "typeIcon": row.get("type_icon", "receipt_long"),
            "amount": row.get("amount", ""),
            "isCredit": bool(row.get("is_credit", False)),
            "isFree": bool(row.get("is_free", False)),
            "category": "service",
            "txHash": row.get("tx_hash", ""),
            "settlement": row.get("settlement", "Completed"),
        }
        for row in raw_service_rows
    ]
    rows = [*service_rows, *_circle_ledger_rows(wallet_address)]
    rows.sort(key=lambda row: row.get("timestamp") or "", reverse=True)
    return {"no_data": False, "records": rows}


# ---------------------------------------------------------------------------
# World ID Selfie Check - authenticated wallet binding
# ---------------------------------------------------------------------------

@app.post("/world-id/rp-signature")
def world_id_rp_signature_endpoint(payload: dict = Body(...)):
    action = payload.get("action", "verify-humanity")
    signing_key = os.environ.get("WORLD_ID_RP_SIGNING_KEY", "").strip()
    rp_id = os.environ.get("WORLD_ID_RP_ID", "").strip()
    if not signing_key or not rp_id:
        raise HTTPException(status_code=503, detail="World ID RP signing is not configured (WORLD_ID_RP_SIGNING_KEY / WORLD_ID_RP_ID).")
    try:
        signed = world_id_provider.generate_rp_signature(signing_key, action)
    except world_id_provider.WorldIdError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"rp_id": rp_id, **signed}


class WorldIdVerifyRequest(BaseModel):
    idkit_result: dict


@app.post("/world-id/verify")
def world_id_verify_endpoint(payload: WorldIdVerifyRequest = Body(...), wallet_address: str = Depends(require_session)):
    rp_id = os.environ.get("WORLD_ID_RP_ID", "").strip()
    if not rp_id:
        raise HTTPException(status_code=500, detail="WORLD_ID_RP_ID is not configured on the server")
    try:
        result = world_id_provider.verify_proof(rp_id, payload.idkit_result)
    except world_id_provider.WorldIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    claim = world_id_store.claim_trial(result["nullifier"], wallet_address)
    if claim.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Trial ledger unavailable: {claim.get('reason')}")

    # A claim produced by the older frontend-only build may already exist for
    # this exact wallet. Migrate it to the 3-scan authoritative ledger and
    # treat the verified user as successfully restored, while still rejecting
    # the same nullifier when it belongs to a different wallet.
    if not claim.get("claimed") and claim.get("reason") == "already_claimed" and claim.get("same_wallet"):
        migrated = world_id_store.migrate_legacy_claim_for_wallet(wallet_address)
        if migrated.get("no_data"):
            raise HTTPException(status_code=503, detail=f"Trial migration unavailable: {migrated.get('reason')}")
        claim = {
            "no_data": False,
            "claimed": True,
            "reason": "already_claimed_same_wallet",
            "wallet_address": wallet_address,
            "scans_granted": entitlement_store.FREE_TRIAL_SCANS,
            "scans_remaining": migrated.get("free_scans_remaining", 0),
        }

    return {**claim, "nullifier": result["nullifier"], "entitlement": entitlement_store.get_entitlements(wallet_address)}


@app.get("/world-id/status")
def world_id_status_endpoint(wallet_address: str = Depends(require_session)):
    # Identity is the authenticated wallet, not a caller-supplied address.
    world_id_store.migrate_legacy_claim_for_wallet(wallet_address)
    result = world_id_store.get_claim_status_by_wallet_address(wallet_address)
    if not result.get("no_data"):
        result["entitlement"] = entitlement_store.get_entitlements(wallet_address)
    return result


@app.get("/health")
def health():
    return {
        "status": "ok",
        "free_trial_scans": entitlement_store.FREE_TRIAL_SCANS,
        "paid_pack_scans": entitlement_store.PAID_PACK_SCANS,
        "paid_pack_price_usdc": entitlement_store.PAID_PACK_PRICE_USDC,
        "network": arc_provider._arc_blockchain(),
    }
