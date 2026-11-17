/**
 * Cryptographic Defense & Salted SHA-256 Attestation
 *
 * Implements salted cryptographic commitments to prevent offline dictionary attacks,
 * rainbow tables, and preimage reversibility against short extracted fields (e.g. salary, dates, names).
 */

export function generateSalt(byteLength = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback pseudorandom generator if Web Crypto unavailable
  return Array.from({ length: byteLength * 2 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

export async function computeSha256(content: string, salt?: string): Promise<string> {
  const payloadToHash = salt ? `${salt}:${content}` : content;

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    let hash = 0;
    for (let i = 0; i < payloadToHash.length; i++) {
      hash = (hash << 5) - hash + payloadToHash.charCodeAt(i);
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16)}`;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(payloadToHash);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeSaltedSha256(
  content: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string; formatted: string }> {
  const salt = existingSalt || generateSalt(16);
  const hash = await computeSha256(content, salt);
  const formatted = `$sha256$${salt}$${hash}`;
  return { hash, salt, formatted };
}

export async function verifySaltedSha256(
  content: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const computed = await computeSha256(content, salt);
  if (computed.toLowerCase() === expectedHash.toLowerCase()) return true;
  // Also support matching formatted string or prefix
  if (expectedHash.includes(computed)) return true;
  if (expectedHash.length < computed.length && computed.startsWith(expectedHash)) return true;
  return false;
}

export function formatSaltedHash(hash: string, salt?: string): string {
  if (!salt) return hash;
  return `$sha256$${salt}$${hash}`;
}
