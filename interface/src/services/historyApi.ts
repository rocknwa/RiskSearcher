import { ScanHistoryResponse } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

/** This user's past scans from Firestore, most recent first. */
export async function getScanHistory(address: string): Promise<ScanHistoryResponse> {
  if (!apiBaseUrl) {
    throw new Error('The analysis service is not configured. Set VITE_API_BASE_URL and reload the app.');
  }
  const url = new URL(`${apiBaseUrl}/history`);
  url.searchParams.set('address', address);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scan history lookup failed (HTTP ${response.status}).`);
  }
  return response.json();
}
