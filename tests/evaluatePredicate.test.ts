import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePredicate, evaluatePredicateDetailed, takeOpening } from '../src/lib/defense/evaluatePredicate.ts';
import { verifyOpening } from '../src/lib/defense/derivedClaims.ts';
import type { ExtractedCandidate, PredicateSpec } from '../src/types/index.ts';

const cand = (o: Partial<ExtractedCandidate> = {}): ExtractedCandidate => ({
  fieldKey: 'netMonthlySalary',
  fieldLabel: 'Net Monthly Salary',
  found: true,
  value: '$7,420.00',
  exactQuote: 'NET MONTHLY TAKE-HOME DISBURSEMENT:     $7,420.00',
  pageNumber: 1,
  sourceType: 'on_device',
  confidenceScore: 1,
  isGrounded: true,
  isAdversarialAttack: false,
  quarantineReason: null,
  ...o,
});

const atLeast = (t: number, currency?: string): PredicateSpec => ({
  kind: 'amount_at_least',
  fieldKey: 'netMonthlySalary',
  fieldLabel: 'Net Monthly Salary',
  threshold: t,
  currency,
  humanRequirement: `Net monthly salary is at least ${t} ${currency || ''}`,
});

test('happy path; claim is NOT pre-approved and opens locally', async () => {
  const c = await evaluatePredicate(cand(), atLeast(5000, 'USD'));
  assert.ok(c && c.result === true);
  assert.equal(c.approvedByUser, false);
  const o = takeOpening(c.id)!;
  assert.equal(await verifyOpening(c.commitmentHash, o), true);
  assert.ok(!JSON.stringify(c).includes('7,420') && !JSON.stringify(c).includes(o.salt));
});

test('old bug: several numbers in one value are no longer concatenated into a huge amount', async () => {
  const c = cand({ value: 'KES 80,000 (gross) 65,000', exactQuote: 'PAY: KES 80,000 (gross) 65,000' });
  assert.equal(await evaluatePredicate(c, atLeast(1000, 'KES')), null);
});

test('old bug: ambiguous formats rejected', async () => {
  assert.equal(await evaluatePredicate(cand({ value: '1.234.567', exactQuote: 'PAY 1.234.567' }), atLeast(10, 'USD')), null);
});

test('old bug: missing/unknown currency no longer assumed to match', async () => {
  const noCur = cand({ value: '7,420.00', exactQuote: 'NET: 7,420.00' });
  assert.deepEqual(await evaluatePredicateDetailed(noCur, atLeast(5000, 'KES')), { claim: null, reason: 'currency_unknown' });
  assert.deepEqual(await evaluatePredicateDetailed(noCur, atLeast(5000)), { claim: null, reason: 'bad_spec' });
  const ugx = cand({ value: 'UGX 7,420,000', exactQuote: 'NET: UGX 7,420,000' });
  assert.deepEqual(await evaluatePredicateDetailed(ugx, atLeast(5000, 'KES')), { claim: null, reason: 'currency_mismatch' });
});

test('old bug: amount_between now checks currency too', async () => {
  const spec: PredicateSpec = {
    kind: 'amount_between',
    fieldKey: 'netMonthlySalary',
    fieldLabel: 'Net',
    min: 1,
    max: 9999999,
    currency: 'KES',
    humanRequirement: 'Between 1 and 9999999 KES',
  };
  assert.deepEqual(await evaluatePredicateDetailed(cand(), spec), { claim: null, reason: 'currency_mismatch' });
});

test('old bug: tenure rounds down by day (28 Nov 2025 is NOT 12 months on 22 Nov 2026)', async () => {
  const c = cand({ fieldKey: 'startDate', value: '28 November 2025', exactQuote: 'DATE OF JOINING: 28 November 2025' });
  const spec: PredicateSpec = {
    kind: 'tenure_at_least_months',
    fieldKey: 'startDate',
    fieldLabel: 'Tenure',
    months: 12,
    humanRequirement: 'At least 12 months tenure',
  };
  const r = await evaluatePredicateDetailed(c, spec, { now: new Date('2026-11-22T00:00:00Z') });
  assert.ok(r.claim && r.claim.result === false);
});

test('old bug: day-first dates (03/04/2021 is 3 April, not 4 March)', async () => {
  const c = cand({ fieldKey: 'startDate', value: '03/04/2021', exactQuote: 'JOINED: 03/04/2021' });
  const spec: PredicateSpec = {
    kind: 'tenure_at_least_months',
    fieldKey: 'startDate',
    fieldLabel: 'Tenure',
    months: 1,
    humanRequirement: 'At least 1 month tenure',
  };
  const r = await evaluatePredicateDetailed(c, spec, { now: new Date('2021-04-20T00:00:00Z') });
  assert.ok(r.claim && r.claim.result === false); // only 17 days since 3 April
});

test('old bug: text_matches substring hole (empty / tiny strings matched everything)', async () => {
  const mk = (value: string, expectedText: string) =>
    evaluatePredicate(
      cand({ fieldKey: 'employer', value, exactQuote: `EMPLOYER: ${value}` }),
      { kind: 'text_matches', fieldKey: 'employer', fieldLabel: 'Employer', expectedText, humanRequirement: `Matches ${expectedText}` }
    );
  assert.equal(await mk('Ltd', 'Safaricom'), null); // empty after normalisation
  const a = await mk('A', 'Alpha Holdings'); // used to be YES via includes()
  assert.ok(a && a.result === false);
  const ok = await mk('Safaricom PLC', 'SAFARICOM Limited');
  assert.ok(ok && ok.result === true);
});

test('old bug: claim from the wrong field is refused', async () => {
  const wrong = cand({ fieldKey: 'grossSalary' });
  assert.deepEqual(await evaluatePredicateDetailed(wrong, atLeast(5000, 'USD')), { claim: null, reason: 'field_mismatch' });
});

test('quarantined / ungrounded never yield a claim', async () => {
  assert.equal(await evaluatePredicate(cand({ isAdversarialAttack: true }), atLeast(1, 'USD')), null);
  assert.equal(await evaluatePredicate(cand({ isGrounded: false }), atLeast(1, 'USD')), null);
});
