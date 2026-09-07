import { AnalysisApiResult, AnalysisProgressEvent, AnalysisStreamHandlers } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const CONNECTION_TIMEOUT_MS = 90_000;

function isAnalysisResult(value: unknown): value is AnalysisApiResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AnalysisApiResult>;
  return typeof result.verdict === 'string'
    && typeof result.severity === 'string'
    && typeof result.score === 'number'
    && Number.isFinite(result.score)
    && Array.isArray(result.breakdown);
}

function debugStream(message: string, details?: unknown) {
  if (import.meta.env.DEV) console.debug(`[RiskSearcher SSE] ${message}`, details);
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The analysis connection was cancelled before the report completed.';
  }
  return error instanceof Error ? error.message : 'An unknown frontend error occurred while reading the analysis stream.';
}

interface SseEvent {
  event: string;
  data: string;
}

/** Parses one SSE event block. A network chunk is not assumed to be an event. */
function parseSseEvent(block: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    if (field === 'data') dataLines.push(value);
  }

  return dataLines.length ? { event, data: dataLines.join('\n') } : null;
}

/**
 * Reads the FastAPI `text/event-stream` response with a buffered UTF-8 parser.
 * This avoids relying on EventSource lifecycle behavior and retains HTTP and
 * parser diagnostics when Render has already accepted the request.
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

  const controller = new AbortController();
  let cancelled = false;
  let completed = false;
  let receivedEvent = false;
  let failureReported = false;
  const connectionTimeout = window.setTimeout(() => {
    if (!receivedEvent) controller.abort();
  }, CONNECTION_TIMEOUT_MS);

  const reportFailure = (message: string, details?: unknown) => {
    if (failureReported || completed || cancelled) return;
    failureReported = true;
    window.clearTimeout(connectionTimeout);
    debugStream(message, details);
    handlers.onError(message);
  };

  const handleEvent = (event: SseEvent) => {
    receivedEvent = true;
    window.clearTimeout(connectionTimeout);
    debugStream('raw SSE event text', `event: ${event.event}\ndata: ${event.data}`);

    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      reportFailure('Backend responded successfully, but frontend failed to parse an analysis stream event.', { event, error });
      return;
    }

    if (event.event === 'progress') {
      if (!payload || typeof payload !== 'object' || typeof (payload as AnalysisProgressEvent).message !== 'string') {
        reportFailure('Backend responded successfully, but sent an invalid progress event.', payload);
        return;
      }
      handlers.onProgress(payload as AnalysisProgressEvent);
      return;
    }

    if (event.event === 'result') {
      if (!isAnalysisResult(payload)) {
        reportFailure('Backend responded successfully, but sent an invalid final analysis result.', payload);
        return;
      }
      completed = true;
      debugStream('parsed final result', payload);
      handlers.onResult(payload);
      return;
    }

    if (event.event === 'error') {
      const message = payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : 'The backend reported an analysis error.';
      reportFailure(message, payload);
    }
  };

  const consume = async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type');
      debugStream('response received', { status: response.status, contentType, url: response.url });

      if (!response.ok) {
        const body = await response.text();
        reportFailure(`The analysis service returned HTTP ${response.status}.`, { body: body.slice(0, 1000), contentType, url: response.url });
        return;
      }
      if (!contentType?.toLowerCase().includes('text/event-stream') || !response.body) {
        reportFailure('Backend responded successfully, but frontend expected an SSE analysis stream.', { contentType, url: response.url });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const drain = (allowIncomplete = false) => {
        while (true) {
          const delimiter = /\r?\n\r?\n/.exec(buffer);
          if (!delimiter || delimiter.index === undefined) break;
          const block = buffer.slice(0, delimiter.index);
          buffer = buffer.slice(delimiter.index + delimiter[0].length);
          const event = parseSseEvent(block);
          if (event) handleEvent(event);
          if (completed || failureReported) return;
        }
        if (allowIncomplete && buffer.trim()) {
          const event = parseSseEvent(buffer);
          buffer = '';
          if (event) handleEvent(event);
        }
      };

      while (!completed && !failureReported && !cancelled) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          drain();
        }
        if (done) {
          buffer += decoder.decode();
          drain(true);
          break;
        }
      }

      if (!completed && !failureReported && !cancelled) {
        reportFailure(receivedEvent
          ? 'The analysis stream ended before a final result was received.'
          : 'The analysis service closed the connection before sending any stream events.');
      }
    } catch (error) {
      if (cancelled) return;
      if (error instanceof DOMException && error.name === 'AbortError' && !receivedEvent) {
        reportFailure('The analysis service did not begin streaming within 90 seconds. Please retry if the service is unavailable.');
        return;
      }
      reportFailure(receivedEvent
        ? `The analysis stream was interrupted before completion: ${describeError(error)}`
        : `Unable to establish the analysis stream: ${describeError(error)}`);
    } finally {
      window.clearTimeout(connectionTimeout);
    }
  };

  void consume();
  return () => {
    cancelled = true;
    window.clearTimeout(connectionTimeout);
    controller.abort();
  };
}
