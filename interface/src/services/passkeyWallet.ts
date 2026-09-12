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
const CLIENT_KEY = import.meta.env.VITE_CIRCLE_CLIENT_KEY?.trim();
const CLIENT_URL = (import.meta.env.VITE_CIRCLE_CLIENT_URL?.trim() || 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl').replace(/\/$/, '');

type CircleCredential = Awaited<ReturnType<typeof toWebAuthnCredential>>;
let activeCredential: CircleCredential | null = null;

function requireClientKey(): string {
  if (!CLIENT_KEY) throw new Error('VITE_CIRCLE_CLIENT_KEY is not configured — set it and reload.');
  return CLIENT_KEY;
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

function rememberCredential(username: string, credential: CircleCredential): void {
  // Keep only the display/login name across reloads. The credential object is
  // kept in memory for the immediate signed-nonce exchange; serializing WebAuthn
  // credential data through localStorage can corrupt binary fields on some
  // browsers. A refreshed browser restores the backend bearer session instead.
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
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
  const credential = await toWebAuthnCredential({
    transport: toPasskeyTransport(CLIENT_URL, clientKey),
    mode: WebAuthnMode.Login,
    username,
  });
  const smartAccount = await smartAccountForCredential(credential, clientKey);
  rememberCredential(username, credential);
  return { address: smartAccount.address, username };
}

/** Sign the backend nonce with the same passkey-backed smart account. */
export async function signPasskeyMessage(message: string): Promise<string> {
  const smartAccount = await smartAccountForCredential(getActiveCredential(), requireClientKey());
  return smartAccount.signMessage({ message });
}
