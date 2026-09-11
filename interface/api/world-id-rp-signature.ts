// Vercel serverless function - lives in the same deployment as the React
// frontend, so the browser can call it same-origin with no CORS setup.
//
// World ID 4.0 requires every IDKit request (Selfie Check included) to
// carry an rp_context signed with the app's secret RP signing_key. That
// key must never reach the browser or get checked into the Python
// backend's repo - keeping the sign step in a Vercel function scoped to
// this same project keeps it isolated with its own env var.
//
// NOTE: this previously imported `signRequest` from `@worldcoin/idkit-server`,
// which is not a real published package under the @worldcoin npm scope.
// That bad import made this function fail to run correctly, so every call
// hung until Vercel killed it (504 / FUNCTION_INVOCATION_TIMEOUT) - which
// also meant the IDKit widget on the client never opened and never asked
// for camera access. The real subpath export for this, per World's own
// integration docs (docs.world.org/world-id/idkit/integrate), lives in
// `@worldcoin/idkit-core/signing` - a package already listed in
// package.json. Signing is standard Ethereum EIP-191 message signing over
// secp256k1 - not the BabyJubJub/Poseidon2 zk-native scheme used elsewhere
// in the World ID protocol stack - which is why it can run in pure JS with
// no WASM, in an ordinary serverless function.
import { signRequest } from '@worldcoin/idkit-core/signing';

export const config = { runtime: 'nodejs' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ detail: 'Method not allowed' }), { status: 405 });
  }

  const signingKeyHex = process.env.WORLD_ID_RP_SIGNING_KEY;
  const rpId = process.env.WORLD_ID_RP_ID;
  if (!signingKeyHex || !rpId) {
    return new Response(
      JSON.stringify({ detail: 'World ID RP signing is not configured (WORLD_ID_RP_SIGNING_KEY / WORLD_ID_RP_ID).' }),
      { status: 503 },
    );
  }

  let action = '';
  try {
    const body = await req.json();
    action = typeof body?.action === 'string' ? body.action : '';
  } catch {
    return new Response(JSON.stringify({ detail: 'Invalid JSON body' }), { status: 400 });
  }

  try {
    const signed = signRequest({ signingKeyHex, action });
    return new Response(
      JSON.stringify({
        rp_id: rpId,
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        sig: signed.sig,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ detail: error instanceof Error ? error.message : 'RP signature generation failed' }),
      { status: 500 },
    );
  }
}
