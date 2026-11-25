import { computeSha256, generateSalt } from './crypto';

export interface CandidateLike {
  fieldKey: string;
  fieldLabel?: string;
  found: boolean;
  value?: unknown;
  exactQuote?: string;
  pageNumber?: number;
  sourceType?: string;
  isGrounded?: boolean;
  isAdversarialAttack?: boolean;
  quarantineReason?: string | null;
}

export type PredicateSpec =
  | { kind: 'money_gte'; predicateKey: string; label: string; sourceFieldKey: string; threshold: number; currency: string }
  | { kind: 'money_between'; predicateKey: string; label: string; sourceFieldKey: string; min: number; max: number; currency: string }
  | { kind: 'tenure_gte_months'; predicateKey: string; label: string; sourceFieldKey: string; months: number }
  | { kind: 'text_equals'; predicateKey: string; label: string; sourceFieldKey: string; expected: string };

export type DeriveFailure =
  | 'not_found'
  | 'not_grounded'
  | 'quarantined_attack'
  | 'field_mismatch'
  | 'value_not_in_quote'
  | 'currency_unknown'
  | 'currency_mismatch'
  | 'date_in_future'
  | 'unparseable_value'
  | 'bad_spec';

export interface DerivedOpening {
  predicateKey: string;
  canonical: string;
  salt: string;
}

export interface DerivedClaimPayload {
  predicateKey: string;
  statement: string;
  result: boolean;
  commitment: string;
}

export type DeriveResult =
  | { ok: true; claim: DerivedClaimPayload; opening: DerivedOpening }
  | { ok: false; reason: DeriveFailure };

/**
 * Strict Money Parser
 * Parses valid amounts with currencies (USD, KES, Ksh., EUR, GBP, UGX, TZS)
 * Rejects ambiguous (7,42, 7.420, 1.234.567), negative (-500), multiple amounts ("80,000 (gross) 65,000"),
 * or conflicting currency tokens ("KES 5,000 USD").
 */
export function parseMoney(input: unknown): { amount: number; currency: string | null } | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (isNaN(input) || input < 0 || !isFinite(input)) return null;
    return { amount: input, currency: null };
  }
  if (typeof input !== 'string') return null;

  const raw = input.trim();
  if (!raw) return null;

  // Reject negative numbers
  if (raw.includes('-')) return null;

  // Extract currency tokens and validate count
  const currencyMatches = raw.match(/(Ksh\.?|\/=|[$€£]|\b(USD|KES|KSH|EUR|GBP|UGX|TZS)\b)/gi) || [];
  if (currencyMatches.length > 1) {
    // In Kenya, "Ksh. 80,000/=" or "KES 100,000/=" combines currency prefix with "/=" suffix
    const isKenyanCombo =
      currencyMatches.length === 2 &&
      currencyMatches.some((m) => /Ksh\.?|KES|KSH/i.test(m)) &&
      currencyMatches.some((m) => /\/=/.test(m));
    if (!isKenyanCombo) return null; // Reject duplicate symbols like $$$5000 or KES KES 5000
  }

  const detectedCurrencies: string[] = [];
  if (/\bUSD\b|\$/i.test(raw)) detectedCurrencies.push('USD');
  if (/\bKES\b|\bKSH\b|Ksh\.?|\/=/i.test(raw)) detectedCurrencies.push('KES');
  if (/\bEUR\b|€/i.test(raw)) detectedCurrencies.push('EUR');
  if (/\bGBP\b|£/i.test(raw)) detectedCurrencies.push('GBP');
  if (/\bUGX\b/i.test(raw)) detectedCurrencies.push('UGX');
  if (/\bTZS\b/i.test(raw)) detectedCurrencies.push('TZS');

  const uniqueCurrencies = Array.from(new Set(detectedCurrencies));
  if (uniqueCurrencies.length > 1) return null; // Conflicting currencies
  const currency = uniqueCurrencies.length === 1 ? uniqueCurrencies[0] : null;

  // Strip recognized currency symbols and tokens cleanly in one pass
  let cleaned = raw
    .replace(/(Ksh\.?|\/=|[$€£]|\b(USD|KES|KSH|EUR|GBP|UGX|TZS)\b)/gi, ' ')
    .trim();

  // If any other letters, words (e.g. NET, gross) or illegal symbols remain, reject
  if (/[^\d,.\s]/.test(cleaned)) {
    return null;
  }

  // Reject multiple dots (e.g. 1.234.567)
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) return null;

  // Reject more than 2 decimal digits for money or ambiguous 3-digit dot without comma (e.g. 100.5555, 7.420)
  if (/\.\d{3,}$/.test(cleaned)) return null;

  // Reject ambiguous comma with 1 or 2 digits at end (e.g. 7,42)
  if (/,\d{1,2}$/.test(cleaned)) return null;

  // Check for spaces
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    // Reject multiple numbers without currency context
    if (!currency) return null;

    // Must be valid space-separated thousands (e.g. "1 250 000.50")
    if (parts[0].length === 0 || parts[0].length > 3 || !/^\d{1,3}$/.test(parts[0])) return null;

    let validSpaced = true;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1 && p.includes('.')) {
        const [intPart, decPart] = p.split('.');
        if (intPart.length !== 3 || !/^\d{3}$/.test(intPart) || !/^\d{1,2}$/.test(decPart)) {
          validSpaced = false;
          break;
        }
      } else {
        if (!/^\d{3}$/.test(p)) {
          validSpaced = false;
          break;
        }
      }
    }
    if (!validSpaced) return null;
    cleaned = parts.join('');
  }

  // Validate comma thousands groupings (e.g. "80,000" or "7,420.00")
  if (cleaned.includes(',')) {
    const [intPart, decPart] = cleaned.split('.');
    const commaParts = intPart.split(',');
    if (commaParts[0].length === 0 || commaParts[0].length > 3) return null;
    for (let i = 1; i < commaParts.length; i++) {
      if (commaParts[i].length !== 3 || !/^\d{3}$/.test(commaParts[i])) return null;
    }
    cleaned = commaParts.join('') + (decPart !== undefined ? `.${decPart}` : '');
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0 || !isFinite(parsed)) return null;

  return { amount: parsed, currency };
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Strict Date Parser supporting Day-First and International Formats
 * Validates days in months (e.g., rejects 31/02/2021)
 */
export function parseDate(input: string | null | undefined, dayFirst = true): Date | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const y = +isoMatch[1];
    const m = +isoMatch[2];
    const d = +isoMatch[3];
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
    return null;
  }

  // 2. Slash or dash numeric: DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (slashMatch) {
    let d = +slashMatch[1];
    let m = +slashMatch[2];
    const y = +slashMatch[3];
    if (!dayFirst) {
      d = +slashMatch[2];
      m = +slashMatch[1];
    }
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
    return null;
  }

  // 3. Textual month: "15 March 2021", "28 November 2025"
  const dmyMatch = /^(\d{1,2})\s+([a-zA-Z]+)[,\s]+(\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const d = +dmyMatch[1];
    const mName = dmyMatch[2].toLowerCase();
    const y = +dmyMatch[3];
    const m = MONTH_NAMES[mName];
    if (m !== undefined) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
        return dt;
      }
    }
    return null;
  }

  // 4. Textual month: "March 15, 2021"
  const mdyMatch = /^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{4})$/.exec(trimmed);
  if (mdyMatch) {
    const mName = mdyMatch[1].toLowerCase();
    const d = +mdyMatch[2];
    const y = +mdyMatch[3];
    const m = MONTH_NAMES[mName];
    if (m !== undefined) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
        return dt;
      }
    }
    return null;
  }

  return null;
}

/**
 * Calculates exact full months between two dates down to the day.
 */
export function monthsBetween(from: Date, to: Date): number {
  if (to < from) return 0;
  const yearsDiff = to.getUTCFullYear() - from.getUTCFullYear();
  const monthsDiff = to.getUTCMonth() - from.getUTCMonth();
  let total = yearsDiff * 12 + monthsDiff;
  if (to.getUTCDate() < from.getUTCDate()) {
    total -= 1;
  }
  return Math.max(0, total);
}

/**
 * Normalizes company / text for exact equality comparison.
 * Strips legal suffixes, punctuation, whitespace, and lowercases.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llc|inc|incorporated|corp|corporation|group|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Core Predicate Derivation Engine
 */
export async function deriveClaim(
  candidate: CandidateLike,
  spec: PredicateSpec,
  opts: { now?: Date; dayFirst?: boolean } = {}
): Promise<DeriveResult> {
  if (!candidate.found) return { ok: false, reason: 'not_found' };
  if (candidate.isAdversarialAttack) return { ok: false, reason: 'quarantined_attack' };
  if (!candidate.isGrounded) return { ok: false, reason: 'not_grounded' };
  if (candidate.fieldKey !== spec.sourceFieldKey) return { ok: false, reason: 'field_mismatch' };

  const strVal = candidate.value !== undefined && candidate.value !== null ? String(candidate.value).trim() : '';
  const quote = (candidate.exactQuote || '').trim();

  // Strict value containment check inside cited quote
  if (quote && strVal) {
    const normQuote = quote.replace(/\s+/g, ' ').toLowerCase();
    const normVal = strVal.replace(/\s+/g, ' ').toLowerCase();
    if (!normQuote.includes(normVal)) {
      return { ok: false, reason: 'value_not_in_quote' };
    }
  }

  let result = false;
  let canonical = '';
  let statement = '';

  switch (spec.kind) {
    case 'money_gte': {
      const parsed = parseMoney(candidate.value);
      if (!parsed) return { ok: false, reason: 'unparseable_value' };
      if (!parsed.currency) return { ok: false, reason: 'currency_unknown' };
      if (parsed.currency.toUpperCase() !== spec.currency.toUpperCase()) {
        return { ok: false, reason: 'currency_mismatch' };
      }
      result = parsed.amount >= spec.threshold;
      canonical = `${spec.currency.toUpperCase()}:${parsed.amount.toFixed(2)}`;
      statement = `${spec.label} is at least ${spec.threshold.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${spec.currency}: ${result ? 'YES' : 'NO'}`;
      break;
    }

    case 'money_between': {
      const parsed = parseMoney(candidate.value);
      if (!parsed) return { ok: false, reason: 'unparseable_value' };
      if (!parsed.currency) return { ok: false, reason: 'currency_unknown' };
      if (parsed.currency.toUpperCase() !== spec.currency.toUpperCase()) {
        return { ok: false, reason: 'currency_mismatch' };
      }
      result = parsed.amount >= spec.min && parsed.amount <= spec.max;
      canonical = `${spec.currency.toUpperCase()}:${parsed.amount.toFixed(2)}`;
      statement = `${spec.label} is between ${spec.min.toLocaleString('en-US')} and ${spec.max.toLocaleString('en-US')} ${spec.currency}: ${result ? 'YES' : 'NO'}`;
      break;
    }

    case 'tenure_gte_months': {
      const date = parseDate(strVal, opts.dayFirst ?? true);
      if (!date) return { ok: false, reason: 'unparseable_value' };
      const now = opts.now || new Date();
      if (date > now) return { ok: false, reason: 'date_in_future' };
      const elapsed = monthsBetween(date, now);
      result = elapsed >= spec.months;
      canonical = date.toISOString().slice(0, 10);
      statement = `${spec.label} is at least ${spec.months} months: ${result ? 'YES' : 'NO'}`;
      break;
    }

    case 'text_equals': {
      const normCand = normalizeText(strVal);
      const normExp = normalizeText(spec.expected);
      if (!normCand || !normExp) return { ok: false, reason: 'unparseable_value' };
      result = normCand === normExp;
      canonical = normCand;
      statement = `${spec.label} matches "${spec.expected}": ${result ? 'YES' : 'NO'}`;
      break;
    }

    default:
      return { ok: false, reason: 'bad_spec' };
  }

  const salt = generateSalt(32);
  const hash = await computeSha256(`${spec.predicateKey}|${canonical}|${salt}`);
  const commitment = `$sha256$${hash}`;

  const opening: DerivedOpening = {
    predicateKey: spec.predicateKey,
    canonical,
    salt,
  };

  const claim: DerivedClaimPayload = {
    predicateKey: spec.predicateKey,
    statement,
    result,
    commitment,
  };

  return { ok: true, claim, opening };
}

/**
 * Cryptographic Opening Verification
 * Verifies that the commitment matches fieldKey | canonical value | salt
 */
export async function verifyOpening(commitment: string, opening: DerivedOpening): Promise<boolean> {
  if (!commitment || !opening) return false;
  const hash = await computeSha256(`${opening.predicateKey}|${opening.canonical}|${opening.salt}`);
  const expected = `$sha256$${hash}`;
  return commitment.toLowerCase() === expected.toLowerCase();
}

/**
 * ProbeGuard: Anti-Probing Threshold Query Rate-Limiter
 */
export class ProbeGuard {
  private maxDistinct: number;
  private records: Map<string, Set<number | string>>;

  constructor(maxDistinct = 3) {
    this.maxDistinct = maxDistinct;
    this.records = new Map();
  }

  record(
    counterparty: string,
    spec: {
      sourceFieldKey?: string;
      fieldKey?: string;
      threshold?: number;
      min?: number;
      max?: number;
      months?: number;
    }
  ): { allowed: boolean; warning?: string; distinct: number } {
    const cp = (counterparty || 'anonymous').trim().toLowerCase();
    const field = spec.sourceFieldKey || spec.fieldKey || 'default';
    const key = `${cp}::${field}`;

    if (!this.records.has(key)) {
      this.records.set(key, new Set());
    }

    const set = this.records.get(key)!;
    const thresholdVal = spec.threshold ?? spec.min ?? spec.months;
    if (thresholdVal !== undefined) {
      set.add(thresholdVal);
    }

    const distinct = set.size;
    const allowed = distinct <= this.maxDistinct;
    const warning = allowed
      ? undefined
      : `ProbeGuard Alert: Counterparty "${counterparty}" has queried ${distinct} distinct thresholds on "${field}". This exceeds the privacy limit of ${this.maxDistinct}.`;

    return { allowed, warning, distinct };
  }
}

// Re-export high-level adapter helpers for drop-in backwards compatibility
export {
  evaluatePredicate,
  evaluatePredicateDetailed,
  takeOpening,
  clearOpenings,
  revealsSummary,
} from './evaluatePredicate';
