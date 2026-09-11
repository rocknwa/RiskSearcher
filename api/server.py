"""
FastAPI + SSE server wrapping core.analyzer.analyze().

This is a persistent server, NOT a serverless function — analysis can take
multiple minutes (LLM specialist + judge calls), which would be killed by
standard serverless timeout ceilings (e.g. Vercel's default). Deploy this
on a long-lived host (Railway, Render, Fly.io, or a plain VPS), never as a
serverless function.

Run locally:
    pip install fastapi uvicorn
    uvicorn api.server:app --reload --port 8000

The frontend (interface/) should point VITE_API_BASE_URL at wherever this
ends up hosted — e.g. http://localhost:8000 locally, or the real backend
host once deployed. This is a separate deployment from the Vercel frontend.
"""

import json
import os
import queue
import threading
from typing import Generator

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.analyzer import analyze
from db import scan_history_store, world_id_store
from rpc import arc_provider, world_id_provider

app = FastAPI(title="RiskSearcher API")

# CORS: allow the deployed Vercel frontend, its preview deployments, and local dev.
# The preview regex is intentionally limited to this project; do not use a
# wildcard origin because this API permits credentials.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",  # default Vite dev port
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
    """Format a single Server-Sent Event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _run_analysis_stream(address: str, chain: str, user_address: str = "") -> Generator[str, None, None]:
    """
    Runs analyze() in a background thread (since it's a long, blocking,
    synchronous call) and streams each progress message + the final result
    as SSE events, via a thread-safe queue bridging the two.
    """
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
                "breakdown": result.breakdown,
                "graph_evidence": getattr(result, "graph_evidence", None),
            }
            q.put(("result", result_payload))

            # Best-effort: history saving must never affect the scan result
            # the user already received, or the stream that already
            # completed successfully above.
            if user_address:
                try:
                    scan_history_store.save_scan(user_address, {
                        "contract_address": address,
                        "chain": chain,
                        **result_payload,
                    })
                except Exception as exc:
                    print(f"    [HISTORY] Unexpected error saving scan: {exc}")
        except Exception as exc:
            q.put(("error", {"message": str(exc)}))
        finally:
            q.put(None)  # sentinel: stream is done

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    while True:
        item = q.get()
        if item is None:
            break
        event_type, data = item
        yield _sse_event(event_type, data)


@app.get("/analyze")
def analyze_endpoint(
    address: str = Query(..., description="Contract address to analyze"),
    chain: str = Query("ethereum", description="Chain name, e.g. ethereum, base, arbitrum"),
    user_address: str = Query("", description="Connected wallet address, for scan-history persistence. Optional - omitting it just means this scan isn't saved to history."),
):
    """
    Streams analysis progress and the final result as Server-Sent Events.
    Frontend usage: new EventSource(`${API_BASE}/analyze?address=...&chain=...`)
    """
    return StreamingResponse(
        _run_analysis_stream(address, chain, user_address),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx etc.) so SSE streams live
        },
    )


@app.get("/history")
def history_endpoint(address: str = Query(..., description="Connected wallet address")):
    """Past scans for this user, most recent first. Never raises - a
    Firestore problem comes back as {"no_data": true, "reason": "..."}."""
    return scan_history_store.get_scan_history(address)


class WithdrawRequest(BaseModel):
    address: str  # the user's identity key (their connected EOA)
    destination: str  # where to send USDC on Arc Testnet
    amount: float


class SubscribeRequest(BaseModel):
    address: str
    plan_price: float


def _wallet_and_balance(user_address: str) -> dict:
    """Real Arc Testnet deposit address + live USDC balance for a user.
    Returns a no_data-shaped dict (never raises) if Arc isn't configured
    or the account can't be reached — same discipline as Graph evidence."""
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
def arc_wallet_endpoint(address: str = Query(..., description="Connected wallet address (user identity key)")):
    """Real Arc Testnet deposit address + live USDC balance for this user.
    Creates the wallet on first call; same address is returned on every
    subsequent call. Never raises — a Circle-side or config problem comes
    back as {"no_data": true, "reason": "..."} for the frontend to handle."""
    return _wallet_and_balance(address)


@app.post("/arc/withdraw")
def arc_withdraw_endpoint(payload: WithdrawRequest = Body(...)):
    """Real, on-chain USDC transfer from the user's Arc Testnet wallet to
    an address they specify. 400s only on missing/invalid input; a Circle-
    side failure still returns 200 with {"no_data": true, "reason": "..."}
    so the frontend shows a clean error instead of a stack trace."""
    wallet = arc_provider.get_or_create_wallet(payload.address)
    if wallet.get("no_data"):
        raise HTTPException(status_code=400, detail=f"Arc wallet unavailable: {wallet.get('reason')}")
    return arc_provider.send_usdc(wallet["wallet_id"], payload.destination, payload.amount)


@app.post("/arc/subscribe")
def arc_subscribe_endpoint(payload: SubscribeRequest = Body(...)):
    """Real, on-chain USDC payment from the user's Arc Testnet wallet to
    the platform treasury address (ARC_TREASURY_ADDRESS), for the given
    plan price. Same underlying transfer as /arc/withdraw, different
    destination. Does not itself grant subscription access server-side —
    the frontend marks the plan active once the transfer is confirmed
    submitted; this endpoint's job is only to move the real funds."""
    treasury_address = os.environ.get("ARC_TREASURY_ADDRESS", "").strip()
    if not treasury_address:
        raise HTTPException(status_code=400, detail="ARC_TREASURY_ADDRESS is not configured on the server")
    wallet = arc_provider.get_or_create_wallet(payload.address)
    if wallet.get("no_data"):
        raise HTTPException(status_code=400, detail=f"Arc wallet unavailable: {wallet.get('reason')}")
    return arc_provider.send_usdc(wallet["wallet_id"], treasury_address, payload.plan_price)


class WorldIdVerifyRequest(BaseModel):
    address: str  # connected wallet address, linked to the grant for reference only
    idkit_result: dict  # complete result IDKit's onSuccess/handleVerify received


@app.post("/world-id/rp-signature")
def world_id_rp_signature_endpoint(payload: dict = Body(...)):
    """Server-signed rp_context for an IDKit request. World ID 4.0 requires
    every request (Selfie Check included) to carry this. Signing lives here
    in the Python backend (not a Vercel serverless function) because the
    official @worldcoin/idkit-server package refuses to run outside real
    Node.js - see rpc/world_id_provider.py's module docstring for the full
    story and how this Python port was verified against it."""
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


@app.post("/world-id/verify")
def world_id_verify_endpoint(payload: WorldIdVerifyRequest = Body(...)):
    """Verify a completed Selfie Check proof server-side - never trust the
    client's own "success" state - and, on a first-time verification for
    this human, atomically grant the one-time free trial. A human who
    already claimed a trial with a different wallet gets a clear
    already_claimed response instead of a second grant. This is the real
    Sybil-defense check; everything upstream of this call is just UI."""
    rp_id = os.environ.get("WORLD_ID_RP_ID", "").strip()
    if not rp_id:
        raise HTTPException(status_code=500, detail="WORLD_ID_RP_ID is not configured on the server")

    try:
        result = world_id_provider.verify_proof(rp_id, payload.idkit_result)
    except world_id_provider.WorldIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    claim = world_id_store.claim_trial(result["nullifier"], payload.address)
    if claim.get("no_data"):
        raise HTTPException(status_code=503, detail=f"Trial ledger unavailable: {claim.get('reason')}")
    return {**claim, "nullifier": result["nullifier"]}


@app.get("/world-id/status")
def world_id_status_endpoint(nullifier: str = Query(..., description="World ID nullifier for this human")):
    """Check whether this human (by nullifier) already claimed their
    trial, without claiming it. Called on app load with a nullifier the
    frontend stored locally after a successful verify, so returning users
    don't need to redo Selfie Check every session."""
    return world_id_store.get_claim_status(nullifier)


@app.get("/debug/setup-entity-secret")
def debug_setup_entity_secret(token: str = Query(...)):
    """TEMPORARY, ONE-TIME-USE. Generates a Circle entity secret and
    registers it with Circle in a single call, so this can be done from a
    phone browser with no local machine. Gated by SETUP_TOKEN (a throwaway
    value you set yourself in Render env vars) so a random visitor can't
    trigger it.

    DELETE THIS ENDPOINT (and remove SETUP_TOKEN) immediately after you've
    copied the entity_secret and recovery_file_base64 out of the response —
    it generates a real secret that controls real wallets, and has no
    business staying live in production.
    """
    setup_token = os.environ.get("SETUP_TOKEN", "")
    if not setup_token or token != setup_token:
        raise HTTPException(status_code=403, detail="Invalid or missing setup token")

    api_key = os.environ.get("CIRCLE_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="CIRCLE_API_KEY is not set")

    from circle.web3 import utils

    entity_secret = os.urandom(32).hex()
    try:
        result = utils.register_entity_secret_ciphertext(api_key=api_key, entity_secret=entity_secret)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Registration with Circle failed: {exc}")

    return {
        "entity_secret": entity_secret,
        "note": "Set this exact value as CIRCLE_ENTITY_SECRET in Render env vars, then delete this endpoint.",
        "recovery_file_base64": (result or {}).get("data", {}).get("recoveryFile"),
        "recovery_note": "Save this string somewhere safe (e.g. a private notes app) — Circle needs it if you ever lose entity secret access. It's shown once.",
    }


@app.get("/debug/create-wallet-set")
def debug_create_wallet_set(token: str = Query(...)):
    """TEMPORARY, ONE-TIME-USE. Creates a real Circle wallet set on Arc and
    returns its ID, so you can pin it as CIRCLE_WALLET_SET_ID instead of
    relying on arc_provider's auto-create-and-cache-in-a-json-file fallback
    (which is lost on every Render restart, since Render's disk is
    ephemeral). Gated by the same SETUP_TOKEN as /debug/setup-entity-secret.

    DELETE THIS ENDPOINT immediately after copying wallet_set_id out of the
    response — same reasoning as the entity-secret endpoint: no reason for
    credential/resource-creation machinery to stay live in production.
    """
    setup_token = os.environ.get("SETUP_TOKEN", "")
    if not setup_token or token != setup_token:
        raise HTTPException(status_code=403, detail="Invalid or missing setup token")

    if not os.environ.get("CIRCLE_API_KEY", "").strip() or not os.environ.get("CIRCLE_ENTITY_SECRET", "").strip():
        raise HTTPException(status_code=400, detail="CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET must be set first")

    client = arc_provider._get_client()
    if client is None:
        raise HTTPException(status_code=502, detail="Could not initialize the Circle client — check CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET")

    from circle.web3 import developer_controlled_wallets as dcw

    try:
        api = dcw.WalletSetsApi(client)
        request = dcw.CreateWalletSetRequest.from_dict({"name": "risksearcher-treasury"})
        response = api.create_wallet_set(request)
        wallet_set_id = response.data.wallet_set.id
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Wallet set creation failed: {exc}")

    return {
        "wallet_set_id": wallet_set_id,
        "note": "Set this exact value as CIRCLE_WALLET_SET_ID in Render env vars, then delete this endpoint. Do not call this again — it creates a NEW wallet set each time, it doesn't return an existing one.",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
