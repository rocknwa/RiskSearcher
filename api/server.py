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
import queue
import threading
from typing import Generator

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from core.analyzer import analyze

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


def _run_analysis_stream(address: str, chain: str) -> Generator[str, None, None]:
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
            q.put(("result", {
                "verdict": result.verdict,
                "severity": result.severity,
                "score": result.score,
                "rule_score": getattr(result, "rule_score", None),
                "score_source": getattr(result, "score_source", None),
                "verdict_source": getattr(result, "verdict_source", None),
                "final_reason": getattr(result, "final_reason", ""),
                "breakdown": result.breakdown,
            }))
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
):
    """
    Streams analysis progress and the final result as Server-Sent Events.
    Frontend usage: new EventSource(`${API_BASE}/analyze?address=...&chain=...`)
    """
    return StreamingResponse(
        _run_analysis_stream(address, chain),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx etc.) so SSE streams live
        },
    )


@app.get("/health")
def health():
    return {"status": "ok"}
