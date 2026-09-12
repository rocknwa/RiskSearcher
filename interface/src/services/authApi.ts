const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const SESSION_STORAGE_KEY = 'risksearcher_session_token';
const SESSION_EXPIRY_KEY = 'risksearcher_session_expiry';

function requireApiBase(): string {
  if (!apiBaseUrl) throw new Error('The RiskSearcher API is not configured. Set VITE_API_BASE_URL and reload.');
  return apiBaseUrl;
}

export function getSessionToken(): string | null {
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!token) return null;
  if (expiry && Date.parse(expiry) <= Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

export function setSession(token: string, expiresAt: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
  localStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken();
  if (!token) throw new Error('Your secure session is missing or expired. Sign in with your passkey again.');
  return { ...extra, Authorization: `Bearer ${token}` };
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...authHeaders(),
    },
  });
}

export interface AuthChallenge {
  challenge_id: string;
  message: string;
  expires_at: string;
}

export async function createAuthChallenge(address: string): Promise<AuthChallenge> {
  const base = requireApiBase();
  const response = await fetch(`${base}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Could not create secure session challenge (HTTP ${response.status}).`);
  return body;
}

export async function verifyAuthChallenge(address: string, challengeId: string, signature: string): Promise<void> {
  const base = requireApiBase();
  const response = await fetch(`${base}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, challenge_id: challengeId, signature }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Secure session verification failed (HTTP ${response.status}).`);
  setSession(body.token, body.expires_at);
}

export interface SessionProfile {
  authenticated: boolean;
  wallet_address: string;
}

/** Restore a still-valid backend session after a page reload. */
export async function getSessionProfile(): Promise<SessionProfile> {
  const response = await authFetch(`${requireApiBase()}/auth/session`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(body?.detail || `Session restore failed (HTTP ${response.status}).`);
  }
  return body;
}

export async function logoutSession(): Promise<void> {
  const base = apiBaseUrl;
  const token = getSessionToken();
  clearSession();
  if (!base || !token) return;
  try {
    await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Local logout still succeeds if backend is temporarily unreachable.
  }
}
