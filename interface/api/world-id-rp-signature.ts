// Vercel serverless function - lives in the same deployment as the React
// frontend, so the browser can call it same-origin with no CORS setup.
//
// World ID 4.0 requires every IDKit request (Selfie Check included) to
// carry an rp_context signed with the app's secret RP signing_key. That
// key must never reach the browser or get checked into the Python
// backend's repo - keeping the sign step in a Vercel function scoped to
// this same project keeps it isolated with its own env var.
//
// The signing algorithm itself is standard Ethereum EIP-191 message
// signing over secp256k1 (per @worldcoin/idkit-server's own source
// comments) - not the BabyJubJub/Poseidon2 zk-native scheme used
// elsewhere in the World ID protocol stack. This is why the official
// @worldcoin/idkit-server package can implement it in pure JS with no
// WASM, and why this can live in an ordinary serverless function.
import { signRequest } from '@worldcoin/idkit-server';

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
