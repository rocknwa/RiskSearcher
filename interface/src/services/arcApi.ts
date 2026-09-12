import { ArcTransferResult, ArcWallet, EntitlementState } from '../types';
import { authFetch } from './authApi';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

function requireApiBase(): string {
  if (!apiBaseUrl) throw new Error('The Arc treasury service is not configured. Set VITE_API_BASE_URL and reload.');
  return apiBaseUrl;
}

export async function getArcWallet(): Promise<ArcWallet> {
  const response = await authFetch(`${requireApiBase()}/arc/wallet`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Arc wallet lookup failed (HTTP ${response.status}).`);
  return body;
}

/** Real Arc-Testnet transfer only. This is not a bridge/off-ramp. */
export async function sendUsdc(destination: string, amount: number): Promise<ArcTransferResult> {
  const response = await authFetch(`${requireApiBase()}/arc/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination, amount }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Arc transfer failed (HTTP ${response.status}).`);
  return body;
}

export interface ScanPackPurchaseResult extends ArcTransferResult {
  price_usdc?: number;
  scans?: number;
  credits_granted?: boolean;
  reused_pending?: boolean;
  entitlement?: EntitlementState;
}

export interface ScanPackStatusResult extends ArcTransferResult {
  tx_hash?: string;
  credits_granted?: boolean;
  entitlement?: EntitlementState;
}

/** Starts the fixed $5 testnet-USDC -> 10 scan-credit purchase. */
export async function paySubscription(): Promise<ScanPackPurchaseResult> {
  const response = await authFetch(`${requireApiBase()}/arc/subscribe`, { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Scan-pack payment failed (HTTP ${response.status}).`);
  return body;
}

export async function getSubscriptionStatus(transactionId: string): Promise<ScanPackStatusResult> {
  const url = new URL(`${requireApiBase()}/arc/subscription-status`);
  url.searchParams.set('transaction_id', transactionId);
  const response = await authFetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Payment status lookup failed (HTTP ${response.status}).`);
  return body;
}

export interface PendingScanPackResult {
  no_data?: boolean;
  pending_purchase?: ScanPackStatusResult | null;
}

/** Resume any outstanding $5 scan-pack payment without submitting a second transfer. */
export async function getPendingSubscription(): Promise<PendingScanPackResult> {
  const response = await authFetch(`${requireApiBase()}/arc/pending-subscription`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Pending payment lookup failed (HTTP ${response.status}).`);
  return body;
}
