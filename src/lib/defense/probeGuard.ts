interface ProbeRecord {
  counterparty: string;
  fieldKey: string;
  thresholds: number[];
  lastTimestamp: number;
}

const STORAGE_KEY = 'airlock_probeguard_records';

function getRecords(): Record<string, ProbeRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRecords(records: Record<string, ProbeRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('ProbeGuard failed to save records to localStorage:', e);
  }
}

export interface ProbeGuardCheckResult {
  isProbingAttack: boolean;
  queryCount: number;
  warningMessage?: string;
}

export function recordAndCheckProbe(
  counterpartyName: string,
  fieldKey: string,
  threshold?: number
): ProbeGuardCheckResult {
  if (threshold === undefined || isNaN(threshold)) {
    return { isProbingAttack: false, queryCount: 0 };
  }

  const normalizedCounterparty = (counterpartyName || 'anonymous_verifier').trim().toLowerCase();
  const compositeKey = `${normalizedCounterparty}::${fieldKey.toLowerCase()}`;

  const records = getRecords();
  const existing = records[compositeKey] || {
    counterparty: normalizedCounterparty,
    fieldKey,
    thresholds: [],
    lastTimestamp: Date.now(),
  };

  // Add threshold if not already recorded
  if (!existing.thresholds.includes(threshold)) {
    existing.thresholds.push(threshold);
  }
  existing.lastTimestamp = Date.now();
  records[compositeKey] = existing;
  saveRecords(records);

  const distinctCount = existing.thresholds.length;

  if (distinctCount >= 3) {
    return {
      isProbingAttack: true,
      queryCount: distinctCount,
      warningMessage: `ProbeGuard Alert: Counterparty "${counterpartyName}" has submitted ${distinctCount} different threshold queries for "${fieldKey}". Binary-search threshold probing detected. Answering will incrementally narrow down and disclose your exact confidential value.`,
    };
  }

  return {
    isProbingAttack: false,
    queryCount: distinctCount,
  };
}

export function clearProbeGuardHistory(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
