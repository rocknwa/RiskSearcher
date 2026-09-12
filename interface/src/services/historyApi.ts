import { ScanHistoryResponse } from '../types';
import { authFetch } from './authApi';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

export async function getScanHistory(): Promise<ScanHistoryResponse> {
  if (!apiBaseUrl) throw new Error('The analysis service is not configured. Set VITE_API_BASE_URL and reload.');
  const response = await authFetch(`${apiBaseUrl}/history`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail || `Scan history lookup failed (HTTP ${response.status}).`);
  return body;
}
