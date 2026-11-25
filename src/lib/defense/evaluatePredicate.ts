import type { ExtractedCandidate, PredicateSpec, DerivedClaim } from '../../types';
import {
  deriveClaim,
  parseMoney,
  type PredicateSpec as CoreSpec,
  type DerivedOpening,
  type DeriveFailure,
} from './derivedClaims';

/**
 * Drop-in replacement for the old evaluatePredicate().
 * Same exports (revealsSummary, evaluatePredicate); parsing, safety gates and
 * commitments come from the tested core in ./derivedClaims.ts.
 */

// LOCAL ONLY. Salts/openings never leave the device. Never serialise or send this map.
const openings = new Map<string, DerivedOpening>();
export const takeOpening = (claimId: string): DerivedOpening | undefined => openings.get(claimId);
export const clearOpenings = (): void => openings.clear();

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function revealsSummary(spec: PredicateSpec): string {
  const cur = spec.currency ? ` ${spec.currency}` : '';
  switch (spec.kind) {
    case 'amount_at_least':
      return `Shares one yes/no answer: whether ${spec.fieldLabel} is at least ${fmt(spec.threshold)}${cur}. The exact amount stays on your device.`;
    case 'amount_between':
      return `Shares one yes/no answer: whether ${spec.fieldLabel} is between ${fmt(spec.min)} and ${fmt(spec.max)}${cur}. The exact amount stays on your device.`;
    case 'tenure_at_least_months':
      return `Shares one yes/no answer: whether at least ${spec.months} months have passed. The exact date stays on your device.`;
    case 'text_matches':
      return `Shares one yes/no answer: whether the value matches "${spec.expectedText}". The exact text stays on your device.`;
    default:
      return 'Shares one yes/no answer. The exact value stays on your device.';
  }
}

function toCoreSpec(spec: PredicateSpec, c: ExtractedCandidate): CoreSpec | null {
  const label = spec.fieldLabel;
  const sourceFieldKey = spec.fieldKey;
  const predicateKey = `${spec.kind}:${spec.fieldKey}:${spec.threshold ?? spec.min ?? spec.months ?? spec.expectedText ?? ''}`;
  const base = { predicateKey, label, sourceFieldKey };
  switch (spec.kind) {
    case 'amount_at_least': {
      if (spec.threshold === undefined) return null;
      // If the demand named no currency, only accept the currency the document itself states.
      const currency = spec.currency ?? parseMoney(c.value)?.currency ?? null;
      return currency ? { ...base, kind: 'money_gte', threshold: spec.threshold, currency } : null;
    }
    case 'amount_between': {
      if (spec.min === undefined || spec.max === undefined) return null;
      const currency = spec.currency ?? parseMoney(c.value)?.currency ?? null;
      return currency ? { ...base, kind: 'money_between', min: spec.min, max: spec.max, currency } : null;
    }
    case 'tenure_at_least_months':
      return spec.months === undefined ? null : { ...base, kind: 'tenure_gte_months', months: spec.months };
    case 'text_matches':
      return spec.expectedText ? { ...base, kind: 'text_equals', expected: spec.expectedText } : null;
    default:
      return null;
  }
}

export async function evaluatePredicateDetailed(
  candidate: ExtractedCandidate,
  spec: PredicateSpec,
  opts: { now?: Date; dayFirst?: boolean } = {}
): Promise<{ claim: DerivedClaim } | { claim: null; reason: DeriveFailure | 'bad_spec' }> {
  const core = toCoreSpec(spec, candidate);
  if (!core) return { claim: null, reason: 'bad_spec' };
  const r = await deriveClaim(candidate, core, opts);
  if (!r.ok) return { claim: null, reason: r.reason };

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

  openings.set(id, r.opening);
  return {
    claim: {
      id,
      fieldKey: spec.fieldKey,
      fieldLabel: spec.fieldLabel,
      predicateKind: spec.kind,
      statement: r.claim.statement,
      result: r.claim.result,
      commitmentHash: r.claim.commitment,
      revealsSummary: revealsSummary(spec),
      approvedByUser: false, // only the user's checkbox may set this to true
    },
  };
}

/** Backwards-compatible: returns null when no safe claim can be made. */
export async function evaluatePredicate(
  candidate: ExtractedCandidate,
  spec: PredicateSpec
): Promise<DerivedClaim | null> {
  const r = await evaluatePredicateDetailed(candidate, spec);
  if (!r.claim) console.debug(`[AIRLOCK:PREDICATE] no claim for ${spec.fieldKey}: ${r.reason}`);
  return r.claim;
}
