/** Circle Modular Smart Account passkey identity for Arc Testnet. */
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
const CREDENTIAL_STORAGE_KEY = 'risksearcher_passkey_credential';
const CLIENT_KEY = import.meta.env.VITE_CIRCLE_CLIENT_KEY?.trim();
const CLIENT_URL = (import.meta.env.VITE_CIRCLE_CLIENT_URL?.trim() || 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl').replace(/\/$/, '');

type CircleCredential = Awaited<ReturnType<typeof toWebAuthnCredential>>;
let activeCredential: CircleCredential | null = null;

function readStoredCredential(): CircleCredential | null {
  try {
    const raw = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CircleCredential;
  } catch {
    localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
    return null;
  }
}

function requireClientKey(): string {
  if (!CLIENT_KEY) throw new Error('VITE_CIRCLE_CLIENT_KEY is not configured — set it and reload.');
  return CLIENT_KEY;
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

function rememberCredential(username: string, credential: CircleCredential): void {
  // Circle's WebAuthn credential is serializable public credential metadata; the
  // private key stays inside the platform authenticator/security key. Persisting
  // this metadata lets returning users rebuild the smart-account object without
  // triggering a redundant WebAuthn "login" ceremony before the actual nonce
  // signature. The backend still authenticates ownership by verifying the signed
  // nonce, so localStorage is never treated as proof of identity.
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
  activeCredential = credential;
}

function getActiveCredential(): CircleCredential {
  if (!activeCredential) throw new Error('Passkey session data is unavailable. Sign in with your passkey again.');
  return activeCredential;
}

export interface PasskeyWalletResult { address: string; username: string; }

async function smartAccountForCredential(credential: CircleCredential, clientKey: string) {
  const modularTransport = toModularTransport(`${CLIENT_URL}/arcTestnet`, clientKey);
  const client = createPublicClient({ chain: arcTestnet, transport: modularTransport });
  const smartAccount = await toCircleSmartAccount({
    client,
    owner: toWebAuthnAccount({ credential }),
  });
  createBundlerClient({ account: smartAccount, chain: arcTestnet, transport: modularTransport });
  return smartAccount;
}

export async function createPasskeyWallet(username: string): Promise<PasskeyWalletResult> {
  const clientKey = requireClientKey();
  const credential = await toWebAuthnCredential({
    transport: toPasskeyTransport(CLIENT_URL, clientKey),
    mode: WebAuthnMode.Register,
    username,
  });
  const smartAccount = await smartAccountForCredential(credential, clientKey);
  rememberCredential(username, credential);
  return { address: smartAccount.address, username };
}

export async function signInWithPasskey(username: string): Promise<PasskeyWalletResult> {
  const clientKey = requireClientKey();
  const storedUsername = getStoredUsername();
  let credential = storedUsername === username ? readStoredCredential() : null;

  // Returning users do not need a separate WebAuthn login ceremony just to
  // reconstruct the Circle smart account. Reuse the previously returned public
  // credential metadata and let signPasskeyMessage() perform the single user-
  // presence/biometric prompt that actually authenticates the backend nonce.
  //
  // Older RiskSearcher builds stored only the username. Those users will see the
  // legacy extra prompt once after this upgrade so we can bootstrap and persist
  // the credential metadata; subsequent sign-ins use one passkey prompt.
  if (!credential) {
    credential = await toWebAuthnCredential({
      transport: toPasskeyTransport(CLIENT_URL, clientKey),
      mode: WebAuthnMode.Login,
      username,
    });
    rememberCredential(username, credential);
  } else {
    activeCredential = credential;
  }

  const smartAccount = await smartAccountForCredential(credential, clientKey);
  return { address: smartAccount.address, username };
}

/** Sign the backend nonce with the same passkey-backed smart account. */
export async function signPasskeyMessage(message: string): Promise<string> {
  const smartAccount = await smartAccountForCredential(getActiveCredential(), requireClientKey());
  return smartAccount.signMessage({ message });
}
