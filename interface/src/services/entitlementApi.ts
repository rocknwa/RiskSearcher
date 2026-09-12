import { EntitlementState, LedgerTransaction } from '../types';
import { authFetch } from './authApi';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

function requireApiBase(): string {
  if (!apiBaseUrl) throw new Error('The RiskSearcher API is not configured. Set VITE_API_BASE_URL and reload.');
  return apiBaseUrl;
}

export async function getEntitlements(): Promise<EntitlementState> {
  const response = await authFetch(`${requireApiBase()}/entitlements`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Entitlement lookup failed (HTTP ${response.status}).`);
  return body;
}

export async function getLedger(): Promise<{ no_data: boolean; records: LedgerTransaction[] }> {
  const response = await authFetch(`${requireApiBase()}/ledger`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Ledger lookup failed (HTTP ${response.status}).`);
  return body;
}
