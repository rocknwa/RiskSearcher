"""World ID (Selfie Check) verification client.

verify_proof() calls World's real verify endpoint (POST
https://developer.world.org/api/v4/verify/{rp_id}) with the complete
IDKit result the frontend received from a Selfie Check flow, and returns
the parsed response including the top-level `nullifier` - a stable
per-human, per-action identifier that stays the same no matter which
wallet address the person later connects with. That value is what
db/world_id_store.py keys the trial-claim ledger on; it's the actual
Sybil-defense mechanism this whole integration exists to provide, not a
decorative detail.

Note on RP-signature generation: World ID 4.0 requires every IDKit
request (Selfie Check included) to carry a `rp_context` object signed
server-side with a secret RP signing_key. That signing step does NOT
live in this module or anywhere in the Python backend - it's handled by
a Vercel serverless function (interface/api/world-id-rp-signature.ts)
that ships alongside the React frontend, using the official
@worldcoin/idkit-server npm package. Two reasons for that split:

  1. The signing_key is scoped to the Vercel deployment's own env vars,
     isolated from the Render-hosted Python backend's secrets entirely.
  2. The actual signing algorithm (confirmed from @worldcoin/idkit-server's
     source comments) is standard Ethereum EIP-191 message signing over
     secp256k1 - not the BabyJubJub/Poseidon2 zk-native scheme used
     elsewhere in the World ID protocol stack, and not something that
     needed a hand-rolled Python implementation once the official JS
     package was found to support it directly in pure JS (no WASM).
"""

from __future__ import annotations

import requests

VERIFY_URL_TEMPLATE = "https://developer.world.org/api/v4/verify/{rp_id}"


class WorldIdError(Exception):
    """Raised for any World ID verification failure. Always caught at the
    API layer (api/server.py) - a World-side or config problem should
    degrade the trial flow with a clear error, never crash a request."""


def verify_proof(rp_id: str, idkit_result: dict) -> dict:
    """Forward the complete IDKit result to World's real verify endpoint.

    `idkit_result` is passed through exactly as IDKit's onSuccess/
    handleVerify gave it to the frontend - already in World's documented
    request shape (protocol_version, nonce, action, responses[]).

    Returns the parsed response dict on success, including the top-level
    `nullifier`. Raises WorldIdError on any failure - always caught by the
    caller so a World-side outage degrades the trial flow, never crashes it.
    Never trust a client-reported "success" without this call: the whole
    point of server-side verification is that the proof's cryptographic
    validity is checked by World, not asserted by the browser.
    """
    if not rp_id:
        raise WorldIdError("Missing rp_id")

    url = VERIFY_URL_TEMPLATE.format(rp_id=rp_id)
    try:
        response = requests.post(url, json=idkit_result, timeout=15)
    except requests.RequestException as exc:
        raise WorldIdError(f"Verify request failed: {exc}") from exc

    try:
        data = response.json()
    except ValueError:
        raise WorldIdError(f"Verify endpoint returned non-JSON response: HTTP {response.status_code}")

    if response.status_code != 200 or not data.get("success"):
        message = data.get("message") or data.get("detail") or f"HTTP {response.status_code}"
        raise WorldIdError(f"World ID verification failed: {message}")

    nullifier = data.get("nullifier")
    if not nullifier:
        raise WorldIdError(f"Verify response missing top-level 'nullifier': {data}")

    return data
