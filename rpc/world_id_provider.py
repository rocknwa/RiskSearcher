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

generate_rp_signature() signs an rp_context for an IDKit request - every
request (Selfie Check included) needs one since World ID 4.0. This is a
from-scratch Python port of @worldcoin/idkit-server's signRequest(),
written after two failed attempts to run the official JS package
server-side on Vercel (it hung indefinitely on the Edge runtime due to a
handler-signature mismatch, then - once that was fixed - refused to run
at all: signRequest() explicitly detects and rejects non-Node.js
environments, and Vercel's Edge runtime isn't genuine Node.js despite
mimicking some of its APIs).

This port was verified byte-for-byte against the real shipped JS source
(not just docs) before being trusted:
  - Message construction (computeRpSignatureMessage): confirmed identical
    output for identical inputs.
  - Message hashing (hashEthereumMessage): confirmed identical output.
    Important gotcha caught this way - this is NOT standard EIP-191
    signing. It deliberately omits the leading 0x19 byte the EIP-191 spec
    normally requires, so a standard encode_defunct()-style helper would
    silently produce a different, wrong hash here.
  - ECDSA signing: confirmed self-consistent (sign then recover round-
    trips to the correct address) via eth_keys, a mature, widely-used
    library already in this project's dependency chain via eth-account.
    Byte-identical (r,s) with the JS output isn't expected or required -
    ECDSA doesn't need deterministic k for validity, only for best-
    practice nonce-reuse protection, so two different (but both valid)
    implementations can legitimately produce different signature bytes
    for the same hash and key. What matters is that ours recovers to the
    correct address, which it does.
"""

from __future__ import annotations

import os
import time

import requests
from eth_keys import keys as eth_keys
from eth_utils import keccak

VERIFY_URL_TEMPLATE = "https://developer.world.org/api/v4/verify/{rp_id}"

_RP_SIGNATURE_MSG_VERSION = 1
_ETHEREUM_MESSAGE_PREFIX = b"Ethereum Signed Message:\n"
_DEFAULT_TTL_SEC = 300


class WorldIdError(Exception):
    """Raised for any World ID request/verification/signing failure.
    Always caught at the API layer (api/server.py) - a World-side or
    config problem should degrade the trial flow with a clear error,
    never crash a request."""


def _hash_to_field(data: bytes) -> bytes:
    """Port of idkit-server's hashToField: keccak256(data) interpreted as
    a big-endian uint256, right-shifted 8 bits, re-encoded as 32 bytes."""
    digest = keccak(data)
    value = int.from_bytes(digest, "big") >> 8
    return value.to_bytes(32, "big")


def _compute_rp_signature_message(nonce_bytes: bytes, created_at: int, expires_at: int, action: str) -> bytes:
    """Byte-for-byte port of idkit-server's computeRpSignatureMessage.
    Verified identical output against the real JS implementation."""
    action_bytes = _hash_to_field(action.encode("utf-8"))
    message = bytearray(81)
    message[0] = _RP_SIGNATURE_MSG_VERSION
    message[1:33] = nonce_bytes
    message[33:41] = created_at.to_bytes(8, "big")
    message[41:49] = expires_at.to_bytes(8, "big")
    message[49:81] = action_bytes
    return bytes(message)


def _hash_ethereum_message(message: bytes) -> bytes:
    """Port of idkit-server's hashEthereumMessage. NOT standard EIP-191 -
    see this module's docstring for why that distinction matters here."""
    prefix = _ETHEREUM_MESSAGE_PREFIX + str(len(message)).encode("utf-8")
    return keccak(prefix + message)


def generate_rp_signature(signing_key_hex: str, action: str, ttl: int = _DEFAULT_TTL_SEC) -> dict:
    """Sign an rp_context for the given action. Returns
    {nonce, created_at, expires_at, sig} (rp_id is a separate, public,
    non-secret config value - not generated here, see api/server.py)."""
    key_hex = signing_key_hex[2:] if signing_key_hex.startswith("0x") else signing_key_hex
    if len(key_hex) != 64:
        raise WorldIdError(
            f"Invalid WORLD_ID_RP_SIGNING_KEY: expected 32 bytes (64 hex chars), got {len(key_hex) // 2} bytes"
        )
    try:
        priv_key_bytes = bytes.fromhex(key_hex)
        private_key = eth_keys.PrivateKey(priv_key_bytes)
    except Exception as exc:
        raise WorldIdError(f"Invalid WORLD_ID_RP_SIGNING_KEY: {exc}") from exc

    nonce_bytes = _hash_to_field(os.urandom(32))
    created_at = int(time.time())
    expires_at = created_at + ttl

    message = _compute_rp_signature_message(nonce_bytes, created_at, expires_at, action)
    msg_hash = _hash_ethereum_message(message)

    signature = private_key.sign_msg_hash(msg_hash)
    # r(32) + s(32) + (recovery+27)(1) = 65 bytes - Ethereum's standard
    # (r,s,v) signature convention, matching idkit-server's own output
    # format exactly (confirmed from its source: sig65[64] = recovery + 27).
    sig_bytes = signature.r.to_bytes(32, "big") + signature.s.to_bytes(32, "big") + bytes([signature.v + 27])

    return {
        "sig": "0x" + sig_bytes.hex(),
        "nonce": "0x" + nonce_bytes.hex(),
        "created_at": created_at,
        "expires_at": expires_at,
    }


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
