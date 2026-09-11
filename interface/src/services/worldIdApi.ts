export interface RpSignature {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  sig: string;
}

export interface TrialClaimResult {
  no_data: boolean;
  claimed: boolean;
  reason?: string;
  scans_granted?: number;
  wallet_address?: string;
  nullifier?: string;
}

export interface TrialStatusResult {
  no_data: boolean;
  claimed: boolean;
  reason?: string;
  scans_granted?: number;
  wallet_address?: string;
  claimed_at?: string | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

function requireApiBase(): string {
  if (!apiBaseUrl) {
    throw new Error('The RiskSearcher API is not configured. Set VITE_API_BASE_URL and reload the app.');
  }
  return apiBaseUrl;
}

/**
 * Server-signed rp_context for an IDKit request. Calls the Vercel
 * serverless function (interface/api/world-id-rp-signature.ts) that ships
 * alongside this frontend - same-origin, no CORS setup needed - rather
 * than the Python backend, since the RP signing_key lives in Vercel's env
 * vars specifically to keep it isolated from the Render-hosted backend.
 */
export async function getRpSignature(action: string): Promise<RpSignature> {
  const response = await fetch('/api/world-id-rp-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.detail || `RP signature request failed (HTTP ${response.status}).`);
  }
  return body;
}

/**
 * Forward a completed IDKit Selfie Check result to the backend for real
 * server-side verification, and atomically claim the one-time free trial
 * for this human (by World ID nullifier) if not already claimed.
 */
export async function verifyWorldId(address: string, idkitResult: unknown): Promise<TrialClaimResult> {
  const base = requireApiBase();
  const response = await fetch(`${base}/world-id/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, idkit_result: idkitResult }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.detail || `World ID verification failed (HTTP ${response.status}).`);
  }
  return body;
}

/**
 * Check whether a previously-stored World ID nullifier already claimed
 * its trial, without claiming it - used to restore verified state across
 * sessions without re-running Selfie Check every time.
 */
export async function getWorldIdStatus(nullifier: string): Promise<TrialStatusResult> {
  const base = requireApiBase();
  const url = new URL(`${base}/world-id/status`);
  url.searchParams.set('nullifier', nullifier);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`World ID status lookup failed (HTTP ${response.status}).`);
  }
  return response.json();
}
