import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMoney,
  parseDate,
  monthsBetween,
  deriveClaim,
  verifyOpening,
  ProbeGuard,
  type CandidateLike,
  type PredicateSpec,
} from '../src/lib/defense/derivedClaims.ts';

const base: CandidateLike = {
  fieldKey: 'netMonthlySalary',
  fieldLabel: 'Net Monthly Salary',
  found: true,
  value: '$7,420.00',
  exactQuote: 'NET MONTHLY TAKE-HOME DISBURSEMENT:     $7,420.00',
  pageNumber: 1,
  sourceType: 'on_device',
  isGrounded: true,
  isAdversarialAttack: false,
};

const gte = (t: number, cur = 'USD'): PredicateSpec => ({
  kind: 'money_gte',
  predicateKey: `sal_gte_${t}`,
  label: 'Net monthly salary',
  sourceFieldKey: 'netMonthlySalary',
  threshold: t,
  currency: cur,
});

test('parseMoney: common formats', () => {
  assert.deepEqual(parseMoney('$7,420.00'), { amount: 7420, currency: 'USD' });
  assert.deepEqual(parseMoney('KES 80,000'), { amount: 80000, currency: 'KES' });
  assert.deepEqual(parseMoney('Ksh. 80,000/='), { amount: 80000, currency: 'KES' });
  assert.deepEqual(parseMoney('80,000 KES'), { amount: 80000, currency: 'KES' });
  assert.deepEqual(parseMoney('KES 1 250 000.50'), { amount: 1250000.5, currency: 'KES' });
  assert.deepEqual(parseMoney('7420'), { amount: 7420, currency: null });
});

test('parseMoney: refuses ambiguous or junk input', () => {
  assert.equal(parseMoney('7,42'), null);
  assert.equal(parseMoney('7.420'), null);
  assert.equal(parseMoney('1.234.567'), null);
  assert.equal(parseMoney('NET 5000'), null);
  assert.equal(parseMoney('KES 5,000 USD'), null);
  assert.equal(parseMoney('-500'), null);
});

test('parseDate + monthsBetween', () => {
  assert.equal(parseDate('2021-03-15')?.toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('15/03/2021')?.toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('15 March 2021')?.toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('March 15, 2021')?.toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('31/02/2021'), null);
  assert.equal(monthsBetween(new Date('2021-03-15'), new Date('2021-09-14')), 5);
  assert.equal(monthsBetween(new Date('2021-03-15'), new Date('2021-09-15')), 6);
});

test('money_gte true/false and boundary', async () => {
  const yes = await deriveClaim(base, gte(5000));
  assert.ok(yes.ok && yes.claim.result === true);
  const no = await deriveClaim(base, gte(8000));
  assert.ok(no.ok && no.claim.result === false);
  const edge = await deriveClaim(base, gte(7420));
  assert.ok(edge.ok && edge.claim.result === true);
});

test('currency mismatch and unknown currency yield no claim', async () => {
  const mism = await deriveClaim(base, gte(5000, 'KES'));
  assert.deepEqual(mism, { ok: false, reason: 'currency_mismatch' });
  const noCur = await deriveClaim({ ...base, value: '7,420.00', exactQuote: 'NET: 7,420.00' }, gte(5000));
  assert.deepEqual(noCur, { ok: false, reason: 'currency_unknown' });
});

test('quarantined, ungrounded and mismatched candidates never yield a claim', async () => {
  assert.deepEqual(await deriveClaim({ ...base, isAdversarialAttack: true }, gte(1)), { ok: false, reason: 'quarantined_attack' });
  assert.deepEqual(await deriveClaim({ ...base, isGrounded: false }, gte(1)), { ok: false, reason: 'not_grounded' });
  assert.deepEqual(await deriveClaim({ ...base, found: false }, gte(1)), { ok: false, reason: 'not_found' });
  assert.deepEqual(await deriveClaim({ ...base, fieldKey: 'other' }, gte(1)), { ok: false, reason: 'field_mismatch' });
  assert.deepEqual(await deriveClaim({ ...base, value: '$950,000.00' }, gte(1)), { ok: false, reason: 'value_not_in_quote' });
});

test('claim JSON never contains the raw value, quote or salt', async () => {
  const r = await deriveClaim(base, gte(5000));
  assert.ok(r.ok);
  const json = JSON.stringify(r.claim);
  assert.ok(!json.includes('7,420') && !json.includes('7420') && !json.includes('TAKE-HOME'));
  assert.ok(!json.includes(r.opening.salt));
  assert.match(r.claim.commitment, /^\$sha256\$[0-9a-f]{64}$/);
});

test('commitment opens correctly and rejects tampering', async () => {
  const r = await deriveClaim(base, gte(5000));
  assert.ok(r.ok);
  assert.equal(await verifyOpening(r.claim.commitment, r.opening), true);
  assert.equal(await verifyOpening(r.claim.commitment, { ...r.opening, canonical: 'USD:9999.00' }), false);
});

test('tenure predicate', async () => {
  const c: CandidateLike = {
    ...base,
    fieldKey: 'employmentStartDate',
    value: '15 March 2021',
    exactQuote: 'DATE OF JOINING: 15 March 2021',
  };
  const spec: PredicateSpec = {
    kind: 'tenure_gte_months',
    predicateKey: 'ten6',
    label: 'Employment duration',
    sourceFieldKey: 'employmentStartDate',
    months: 6,
  };
  const r = await deriveClaim(c, spec, { now: new Date('2026-11-22T00:00:00Z') });
  assert.ok(r.ok && r.claim.result === true);
  const fut = await deriveClaim({ ...c, value: '1 January 2030', exactQuote: 'DATE OF JOINING: 1 January 2030' }, spec, { now: new Date('2026-11-22') });
  assert.deepEqual(fut, { ok: false, reason: 'date_in_future' });
});

test('text_equals ignores case, punctuation and company suffix', async () => {
  const c: CandidateLike = {
    ...base,
    fieldKey: 'employer',
    value: 'Nextrans LIT Solutions Limited',
    exactQuote: 'EMPLOYER: Nextrans LIT Solutions Limited',
  };
  const spec: PredicateSpec = {
    kind: 'text_equals',
    predicateKey: 'emp',
    label: 'Employer',
    sourceFieldKey: 'employer',
    expected: 'NEXTRANS LIT SOLUTIONS LTD.',
  };
  const r = await deriveClaim(c, spec);
  assert.ok(r.ok && r.claim.result === true);
});

test('ProbeGuard flags threshold probing', () => {
  const g = new ProbeGuard(3);
  assert.equal(g.record('Landlord A', gte(5000)).allowed, true);
  assert.equal(g.record('Landlord A', gte(6000)).allowed, true);
  assert.equal(g.record('Landlord A', gte(7000)).allowed, true);
  const fourth = g.record('Landlord A', gte(7400));
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.warning);
  assert.equal(g.record('Landlord B', gte(7400)).allowed, true);
  assert.equal(g.record('Landlord A', gte(5000)).distinct, 4);
});
