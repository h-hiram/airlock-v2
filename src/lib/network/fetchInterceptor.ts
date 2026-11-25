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

function extractBodyAsText(body: BodyInit | null | undefined): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof ArrayBuffer) {
    try {
      return new TextDecoder().decode(body);
    } catch {
      return null;
    }
  }
  if (ArrayBuffer.isView(body)) {
    try {
      return new TextDecoder().decode(body);
    } catch {
      return null;
    }
  }
  return null;
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

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('key')) {
      parsed.searchParams.set('key', '[PROTECTED_IN_ENV]');
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/([?&]key=)[^&]+/gi, '$1[PROTECTED_IN_ENV]');
  }
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

    // Live Canary Leak Audit Scanner
    const bodyText = extractBodyAsText(init?.body);
    const activeCanaries = telemetryStore.getActiveCanaries();
    if (activeCanaries.length > 0) {
      for (const canary of activeCanaries) {
        if (canary && (bodyText?.includes(canary) || url.includes(canary))) {
          console.error(
            `%c🚨 [AIRLOCK:CANARY-LEAK-DETECTED] Active canary "${canary}" intercepted in outbound ${method} request to ${url}!`,
            'background: #881337; color: #fecdd3; font-weight: bold; padding: 4px;'
          );
          telemetryStore.recordCanaryLeak(canary, url);
        }
      }
    }

    try {
      const response = await originalFetch.apply(this, [input, init]);

      let responseBytes = 0;
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        responseBytes = parseInt(contentLengthHeader, 10) || 0;
      }

      if (tier !== 'other' || url.includes('googleapis.com')) {
        const safeUrl = sanitizeUrl(url);
        console.log(
          `%c[AIRLOCK:NETWORK-TAP] Outbound ${method} ➔ ${safeUrl} [${tier}] (%d bytes sent, %d bytes received, status: %d)`,
          'background: #1e1b4b; color: #c7d2fe; padding: 2px 6px; border-radius: 4px;',
          requestBytes,
          responseBytes,
          response.status
        );
        telemetryStore.recordEntry({
          url: safeUrl,
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
          url: sanitizeUrl(url),
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
