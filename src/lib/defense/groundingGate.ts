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
  /assistant:/i,
  /new\s+rule(s)?:/i,
  /act\s+as\s+/i,
  /output\s+field\s+['"]/i,
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

  // 1. Generic Pattern Detection on Value or Citation
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(strValue) || pattern.test(quote)) {
      return {
        isGrounded: false,
        isAdversarialAttack: true,
        quarantineReason: 'Adversarial Prompt-Injection: Candidate text contains an embedded system override directive.',
      };
    }
  }

  // 2. Structural Shape Validation: Documents have "Label: Value" format; prompt commands have imperative structure
  if (/^\[?\s*(system|override|ignore|always|output|assistant|prompt)/i.test(quote)) {
    return {
      isGrounded: false,
      isAdversarialAttack: true,
      quarantineReason: 'Structural Anomaly: Cited excerpt contains imperative instruction syntax rather than documentary text.',
    };
  }

  // 3. Strict Value-in-Quote Containment Check
  if (quote.length > 0 && normVal.length > 0 && !normQuote.includes(normVal)) {
    return {
      isGrounded: false,
      isAdversarialAttack: false,
      quarantineReason: `Citation Contradiction: Extracted value "${strValue}" is not present inside the cited quote "${quote.slice(0, 40)}...".`,
    };
  }

  // 4. Verbatim Quote Existence in Source Document
  if (quote.length > 0 && !normDoc.includes(normQuote)) {
    return {
      isGrounded: false,
      isAdversarialAttack: false,
      quarantineReason: `Unverifiable citation: Cited quote "${quote.slice(0, 36)}..." does not exist in the source document.`,
    };
  }

  // 5. Verbatim Value Grounding in Document
  if (!normDoc.includes(normVal)) {
    return {
      isGrounded: false,
      isAdversarialAttack: false,
      quarantineReason: `Ungrounded hallucination: Value "${strValue}" cannot be grounded in the source text.`,
    };
  }

  // 6. Contextual Proximity Check: Did this quote or value originate within an instruction injection block?
  const hasInjectionSignature = INJECTION_PATTERNS.some((pat) => pat.test(rawDocumentText));
  if (hasInjectionSignature) {
    const rawLower = rawDocumentText.toLowerCase();
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
