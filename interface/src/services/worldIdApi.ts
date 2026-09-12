import { EntitlementState } from '../types';
import { authFetch } from './authApi';

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
  scans_remaining?: number;
  wallet_address?: string;
  nullifier?: string;
  entitlement?: EntitlementState;
}

export interface TrialStatusResult extends TrialClaimResult {
  claimed_at?: string | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
function requireApiBase(): string {
  if (!apiBaseUrl) throw new Error('The RiskSearcher API is not configured. Set VITE_API_BASE_URL and reload.');
  return apiBaseUrl;
}

export async function getRpSignature(action: string): Promise<RpSignature> {
  const response = await fetch(`${requireApiBase()}/world-id/rp-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `RP signature request failed (HTTP ${response.status}).`);
  return body;
}

export async function verifyWorldId(_address: string, idkitResult: unknown): Promise<TrialClaimResult> {
  const response = await authFetch(`${requireApiBase()}/world-id/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idkit_result: idkitResult }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `World ID verification failed (HTTP ${response.status}).`);
  return body;
}

export async function getWorldIdStatus(_nullifier?: string, _walletAddress?: string): Promise<TrialStatusResult> {
  const response = await authFetch(`${requireApiBase()}/world-id/status`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `World ID status lookup failed (HTTP ${response.status}).`);
  return body;
}
