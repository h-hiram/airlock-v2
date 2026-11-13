import type { ExtractedCandidate } from '../../types';

const INJECTION_PATTERNS = [
  /system\s+override/i,
  /disregard\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /always\s+output/i,
  /emergency\s+override\s+mode/i,
  /you\s+are\s+now\s+in/i,
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function evaluateGrounding(
  candidate: ExtractedCandidate,
  rawDocumentText: string
): { isGrounded: boolean; quarantineReason?: string } {
  if (!candidate.found || candidate.value === undefined || candidate.value === '') {
    return { isGrounded: true };
  }

  const strValue = String(candidate.value).trim();
  const quote = (candidate.exactQuote || '').trim();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(strValue) || pattern.test(quote)) {
      return {
        isGrounded: false,
        quarantineReason: 'Adversarial prompt-injection attack pattern detected in candidate output.',
      };
    }
  }

  const normDoc = normalizeWhitespace(rawDocumentText);
  const normQuote = normalizeWhitespace(quote);
  const normVal = normalizeWhitespace(strValue);

  if (quote.length > 0 && !normDoc.includes(normQuote)) {
    return {
      isGrounded: false,
      quarantineReason: `Unverifiable quote: The cited text "${quote.slice(0, 40)}..." does not exist in the source document.`,
    };
  }

  if (!normDoc.includes(normVal) && (quote.length === 0 || !normQuote.includes(normVal))) {
    return {
      isGrounded: false,
      quarantineReason: `Ungrounded value: Extracted answer "${strValue}" cannot be substantiated from the source text.`,
    };
  }

  return { isGrounded: true };
}

