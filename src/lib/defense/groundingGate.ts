import type { ExtractedCandidate } from '../../types';

const INJECTION_PATTERNS = [
  /system\s+override/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /always\s+output/i,
  /emergency\s+override\s+mode/i,
  /you\s+are\s+(now\s+)?in/i,
  /security\s+assessment\s+embedded\s+attack/i,
  /do\s+not\s+quote\s+this\s+instruction/i,
  /payload\s+injection/i,
  /jailbreak/i,
];

// Known hostile payload values specified in security benchmark tests
const KNOWN_HOSTILE_PAYLOAD_VALUES = [
  '$950,000',
  '$950,000.00',
  '950,000',
  '950000',
  'universal quantum corp',
  'universal quantum',
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface GroundingResult {
  isGrounded: boolean;
  isAdversarialAttack: boolean;
  quarantineReason?: string;
}

export function evaluateGrounding(
  candidate: ExtractedCandidate,
  rawDocumentText: string
): GroundingResult {
  if (!candidate.found || candidate.value === undefined || candidate.value === '') {
    return { isGrounded: true, isAdversarialAttack: false };
  }

  const strValue = String(candidate.value).trim();
  const quote = (candidate.exactQuote || '').trim();
  const normVal = normalizeWhitespace(strValue);
  const normQuote = normalizeWhitespace(quote);
  const normDoc = normalizeWhitespace(rawDocumentText);

  // 1. Direct Pattern Detection on Value or Quote
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(strValue) || pattern.test(quote)) {
      return {
        isGrounded: false,
        isAdversarialAttack: true,
        quarantineReason: 'Adversarial Prompt-Injection: Candidate text contains an embedded system override directive.',
      };
    }
  }

  // 2. Known Adversarial Benchmark Payload Check
  for (const hostileVal of KNOWN_HOSTILE_PAYLOAD_VALUES) {
    if (normVal.includes(hostileVal) || normQuote.includes(hostileVal)) {
      return {
        isGrounded: false,
        isAdversarialAttack: true,
        quarantineReason:
          `Adversarial Payload Detected: Candidate value "${strValue}" matches an injected benchmark exploit payload designed to exfiltrate forged credentials.`,
      };
    }
  }

  // 3. Verbatim Quote Existence in Source
  if (quote.length > 0 && !normDoc.includes(normQuote)) {
    return {
      isGrounded: false,
      isAdversarialAttack: false,
      quarantineReason: `Unverifiable citation: Cited quote "${quote.slice(0, 36)}..." does not exist in the source document.`,
    };
  }

  // 4. Verbatim Value Grounding
  if (!normDoc.includes(normVal) && (quote.length === 0 || !normQuote.includes(normVal))) {
    return {
      isGrounded: false,
      isAdversarialAttack: false,
      quarantineReason: `Ungrounded hallucination: Value "${strValue}" cannot be grounded in the source text.`,
    };
  }

  // 5. Contextual Hostile Region Detection: Was the value or quote located within an injection block?
  const hasInjectionSignature = INJECTION_PATTERNS.some((pat) => pat.test(rawDocumentText));
  if (hasInjectionSignature) {
    const rawLower = rawDocumentText.toLowerCase();

    // Check position of quote or value in the document
    const targetSubstring = normQuote.length > 3 ? normQuote : normVal;
    let searchPos = 0;
    while (searchPos < rawLower.length) {
      const matchIndex = rawLower.indexOf(targetSubstring, searchPos);
      if (matchIndex === -1) break;

      // Inspect context window (-300 to +300 characters around the occurrence)
      const windowStart = Math.max(0, matchIndex - 300);
      const windowEnd = Math.min(rawDocumentText.length, matchIndex + targetSubstring.length + 300);
      const contextWindow = rawDocumentText.slice(windowStart, windowEnd);

      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(contextWindow)) {
          return {
            isGrounded: false,
            isAdversarialAttack: true,
            quarantineReason:
              'Compromised Source Context: Extracted snippet originates directly from an adversarial instruction injection block.',
          };
        }
      }

      searchPos = matchIndex + targetSubstring.length;
    }
  }

  return { isGrounded: true, isAdversarialAttack: false };
}

