/**
 * Real passkey-backed smart account on Arc Testnet, via Circle's Modular
 * Wallets SDK (@circle-fin/modular-wallets-core). This replaces the
 * earlier Google/Apple/email approach entirely — no OAuth client IDs, no
 * redirect-URI whitelisting, no backend endpoints at all. Everything
 * here runs client-side, talking directly to Circle's public modular
 * bundler/paymaster.
 *
 * Why this instead of social login: WebAuthn passkeys work on any modern
 * device — Face ID, Touch ID, Windows Hello, Android biometric, or a
 * physical security key — with no per-provider app registration, so
 * anyone (including a judge on an unfamiliar machine/browser) can create
 * an account in one tap. The only one-time setup is in the Circle
 * Console, and it's simpler than social login's:
 *   1. Console → Keys → Create a key → Client Key → VITE_CIRCLE_CLIENT_KEY
 *   2. Console → Wallets → Modular Wallets → Passkey → set the passkey
 *      domain to your deployed origin (e.g. risksearcher.vercel.app —
 *      passkeys are domain-bound, and this must be an HTTPS domain or
 *      localhost, never a raw IP or a Vercel preview subdomain unless
 *      you add each one).
 *   3. VITE_CIRCLE_CLIENT_URL defaults to Circle's fixed public endpoint
 *      below — nothing to create for this one.
 *
 * MSCA (this account type) is supported on Arc Testnet today per
 * Circle's docs, but NOT on Ethereum mainnet, Solana, Aptos, or NEAR —
 * irrelevant here since this project only targets Arc.
 */
import {
  toPasskeyTransport,
  toWebAuthnCredential,
  toModularTransport,
  toCircleSmartAccount,
  WebAuthnMode,
} from '@circle-fin/modular-wallets-core';
import { createPublicClient } from 'viem';
import { createBundlerClient, toWebAuthnAccount } from 'viem/account-abstraction';
import { arcTestnet } from 'viem/chains';

const USERNAME_STORAGE_KEY = 'risksearcher_passkey_username';

const CLIENT_KEY = import.meta.env.VITE_CIRCLE_CLIENT_KEY?.trim();
const CLIENT_URL = (import.meta.env.VITE_CIRCLE_CLIENT_URL?.trim() || 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl').replace(/\/$/, '');

function requireClientKey(): string {
  if (!CLIENT_KEY) {
    throw new Error('VITE_CIRCLE_CLIENT_KEY is not configured — set it in your environment and reload.');
  }
  return CLIENT_KEY;
}

/** Whether this browser has already registered a passkey with us —
 * governs whether the modal shows "Create Passkey Account" or
 * "Sign in with Passkey". This is a local UX hint only; the real check
 * is WebAuthn's own device/passkey-manager prompt. A person can still
 * sign in on a brand-new device if their OS/browser syncs passkeys
 * (iCloud Keychain, Google Password Manager, etc.) via the manual
 * "I already have a passkey" toggle in the modal. */
export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

function rememberUsername(username: string): void {
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export interface PasskeyWalletResult {
  address: string;
  username: string;
}

/**
 * Registers a brand-new passkey (WebAuthnMode.Register) for `username`
 * and creates the deterministic Arc Testnet smart-account address for
 * it. Triggers the browser's real passkey creation prompt (Face ID /
 * Touch ID / Windows Hello / security key) — no mock, no timeout.
 */
export async function createPasskeyWallet(username: string): Promise<PasskeyWalletResult> {
  const clientKey = requireClientKey();
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, clientKey);

  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: WebAuthnMode.Register,
    username,
  });

  const address = await smartAccountAddressForCredential(credential, clientKey);
  rememberUsername(username);
  return { address, username };
}

/**
 * Signs back in with an existing passkey (WebAuthnMode.Login) and
 * returns the same deterministic address that was created at
 * registration time — the address is derived from the passkey's own
 * credential, not stored or looked up anywhere, so it's always correct
 * as long as the same passkey is used.
 */
export async function signInWithPasskey(username: string): Promise<PasskeyWalletResult> {
  const clientKey = requireClientKey();
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, clientKey);

  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: WebAuthnMode.Login,
    username,
  });

  const address = await smartAccountAddressForCredential(credential, clientKey);
  rememberUsername(username);
  return { address, username };
}

async function smartAccountAddressForCredential(
  credential: Awaited<ReturnType<typeof toWebAuthnCredential>>,
  clientKey: string,
): Promise<string> {
  const modularTransport = toModularTransport(`${CLIENT_URL}/arcTestnet`, clientKey);
  const client = createPublicClient({ chain: arcTestnet, transport: modularTransport });

  const smartAccount = await toCircleSmartAccount({
    client,
    owner: toWebAuthnAccount({ credential }),
  });

  // Building the bundler client isn't strictly required just to read the
  // address (it's deterministic from the owner + implementation), but
  // constructing it here — the same way transfers/sponsored gas will
  // later — surfaces any transport/config problem immediately instead of
  // only on the first real transaction.
  createBundlerClient({ account: smartAccount, chain: arcTestnet, transport: modularTransport });

  return smartAccount.address;
}
