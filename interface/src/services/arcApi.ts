import { ArcTransferResult, ArcWallet } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

function requireApiBase(): string {
  if (!apiBaseUrl) {
    throw new Error('The Arc treasury service is not configured. Set VITE_API_BASE_URL and reload the app.');
  }
  return apiBaseUrl;
}

/** Real Arc Testnet deposit address + live USDC balance for this user. Creates the wallet on first call. */
export async function getArcWallet(address: string): Promise<ArcWallet> {
  const base = requireApiBase();
  const url = new URL(`${base}/arc/wallet`);
  url.searchParams.set('address', address);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Arc wallet lookup failed (HTTP ${response.status}).`);
  }
  return response.json();
}

/** Real, on-chain USDC transfer out of the user's Arc Testnet wallet. */
export async function withdrawUsdc(address: string, destination: string, amount: number): Promise<ArcTransferResult> {
  const base = requireApiBase();
  const response = await fetch(`${base}/arc/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, destination, amount }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.detail || `Arc withdrawal failed (HTTP ${response.status}).`);
  }
  return body;
}

/** Real, on-chain USDC payment from the user's Arc Testnet wallet to the platform treasury. */
export async function paySubscription(address: string, planPrice: number): Promise<ArcTransferResult> {
  const base = requireApiBase();
  const response = await fetch(`${base}/arc/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, plan_price: planPrice }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.detail || `Subscription payment failed (HTTP ${response.status}).`);
  }
  return body;
}
