import { AnalysisApiResult, AnalysisProgressEvent, AnalysisStreamHandlers } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const CONNECTION_TIMEOUT_MS = 90_000;

function parseEvent<T>(rawData: string): T | null {
  try {
    return JSON.parse(rawData) as T;
  } catch {
    return null;
  }
}

function isAnalysisResult(value: AnalysisApiResult): boolean {
  return typeof value.verdict === 'string'
    && typeof value.severity === 'string'
    && Number.isFinite(value.score)
    && Array.isArray(value.breakdown);
}

/**
 * Opens one analysis stream. EventSource reconnects automatically, which would
 * start a second expensive analysis after a dropped connection, so failures are
 * deliberately closed and surfaced to the UI for an explicit retry instead.
 */
export function streamContractAnalysis(
  address: string,
  chain: string,
  handlers: AnalysisStreamHandlers,
): () => void {
  if (!apiBaseUrl) {
    window.setTimeout(() => handlers.onError('The analysis service is not configured. Set VITE_API_BASE_URL and reload the app.'), 0);
    return () => undefined;
  }

  const url = new URL(`${apiBaseUrl}/analyze`);
  url.searchParams.set('address', address);
  url.searchParams.set('chain', chain);

  const source = new EventSource(url.toString());
  let completed = false;
  let receivedEvent = false;
  let failureReported = false;

  const reportFailure = (message: string) => {
    if (failureReported || completed) return;
    failureReported = true;
    source.close();
    handlers.onError(message);
  };

  const connectionTimeout = window.setTimeout(() => {
    reportFailure('The analysis service did not begin streaming in time. Render may be waking from a cold start; please retry in a moment.');
  }, CONNECTION_TIMEOUT_MS);

  source.addEventListener('progress', (event) => {
    receivedEvent = true;
    const data = parseEvent<AnalysisProgressEvent>((event as MessageEvent<string>).data);
    if (!data || typeof data.message !== 'string') {
      reportFailure('The analysis service sent an invalid progress update. Please retry the scan.');
      return;
    }
    handlers.onProgress(data);
  });

  source.addEventListener('result', (event) => {
    receivedEvent = true;
    const data = parseEvent<AnalysisApiResult>((event as MessageEvent<string>).data);
    if (!data || !isAnalysisResult(data)) {
      reportFailure('The analysis service returned an invalid report. Please retry the scan.');
      return;
    }
    completed = true;
    window.clearTimeout(connectionTimeout);
    source.close();
    handlers.onResult(data);
  });

  source.addEventListener('error', (event) => {
    const data = parseEvent<{ message?: string }>((event as MessageEvent<string>).data || '');
    reportFailure(data?.message || (receivedEvent
      ? 'The analysis stream was interrupted before the report completed. Please retry the scan.'
      : 'Unable to connect to the analysis service. Render may be starting up; please retry shortly.'));
  });

  source.onerror = () => reportFailure(receivedEvent
    ? 'The analysis stream was interrupted before the report completed. Please retry the scan.'
    : 'Unable to connect to the analysis service. Render may be starting up; please retry shortly.');

  return () => {
    completed = true;
    window.clearTimeout(connectionTimeout);
    source.close();
  };
}
