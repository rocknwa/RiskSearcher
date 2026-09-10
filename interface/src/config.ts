/**
 * Runtime-configurable app constants that aren't secrets - things safe to
 * tune per deployment via Vite env vars without touching component code.
 */

// Defaults to $5 rather than the catalog $20 for hackathon judging: Circle's
// Public Faucet gives 10 USDC/24h per address, so $5 leaves headroom for
// real Arc gas (also USDC-denominated) instead of exactly draining a fresh
// faucet drop. Override with VITE_SUBSCRIPTION_PRICE_USDC if you want a
// different demo price (e.g. "10").
export const SUBSCRIPTION_PRICE_USDC = Number(import.meta.env.VITE_SUBSCRIPTION_PRICE_USDC) || 5;
