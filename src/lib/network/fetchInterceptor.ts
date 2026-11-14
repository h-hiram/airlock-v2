import { telemetryStore } from './telemetryStore';

let isInterceptorInstalled = false;

function calculatePayloadSize(body: BodyInit | null | undefined): number {
  if (!body) return 0;
  if (typeof body === 'string') {
    return new TextEncoder().encode(body).length;
  }
  if (body instanceof Blob) {
    return body.size;
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (ArrayBuffer.isView(body)) {
    return body.byteLength;
  }
  if (body instanceof URLSearchParams) {
    return new TextEncoder().encode(body.toString()).length;
  }
  return 0;
}

function resolveTier(url: string): 'cloud_ai' | 'firestore' | 'app_check' | 'other' {
  if (url.includes('firebasevertexai.googleapis.com') || url.includes('generativelanguage.googleapis.com')) {
    return 'cloud_ai';
  }
  if (url.includes('firestore.googleapis.com')) {
    return 'firestore';
  }
  if (url.includes('firebaseappcheck.googleapis.com')) {
    return 'app_check';
  }
  return 'other';
}

export function installNetworkTap(): void {
  if (isInterceptorInstalled || typeof window === 'undefined') {
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    const requestBytes = calculatePayloadSize(init?.body);
    const tier = resolveTier(url);

    try {
      const response = await originalFetch.apply(this, [input, init]);

      let responseBytes = 0;
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        responseBytes = parseInt(contentLengthHeader, 10) || 0;
      }

      if (tier !== 'other' || url.includes('googleapis.com')) {
        console.log(
          `%c[AIRLOCK:NETWORK-TAP] Outbound ${method} ➔ ${url} [${tier}] (%d bytes sent, %d bytes received, status: %d)`,
          'background: #1e1b4b; color: #c7d2fe; padding: 2px 6px; border-radius: 4px;',
          requestBytes,
          responseBytes,
          response.status
        );
        telemetryStore.recordEntry({
          url,
          method,
          requestBytes,
          responseBytes,
          tier,
        });
      }

      return response;
    } catch (error) {
      if (tier !== 'other') {
        telemetryStore.recordEntry({
          url,
          method,
          requestBytes,
          responseBytes: 0,
          tier,
        });
      }
      throw error;
    }
  };

  isInterceptorInstalled = true;
}

