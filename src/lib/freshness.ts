export type DataFreshnessStatus = 'FRESH' | 'DELAYED' | 'STALE' | 'UNKNOWN';
export type DataFreshnessSeverity = 'success' | 'warning' | 'danger' | 'neutral';

export interface FreshnessPolicy {
  freshForMs: bigint;
  staleAfterMs: bigint;
}

export interface AnalyzeDataFreshnessInput {
  lastUpdatedAtMs: bigint | number | null | undefined;
  nowMs: bigint | number;
  policy: FreshnessPolicy;
}

export interface DataFreshnessModel {
  ageMs: bigint | null;
  freshForMs: bigint;
  isFresh: boolean;
  isStale: boolean;
  isUnknown: boolean;
  lastUpdatedAtMs: bigint | null;
  nowMs: bigint;
  severity: DataFreshnessSeverity;
  staleAfterMs: bigint;
  status: DataFreshnessStatus;
}

export const predictFreshnessPolicies = {
  history: createFreshnessPolicy({ freshForMs: 30_000n, staleAfterMs: 120_000n }),
  oraclePrice: createFreshnessPolicy({ freshForMs: 5_000n, staleAfterMs: 15_000n }),
  oracleSvi: createFreshnessPolicy({ freshForMs: 20_000n, staleAfterMs: 45_000n }),
  serverRender: createFreshnessPolicy({ freshForMs: 30_000n, staleAfterMs: 60_000n }),
} as const;

export function createFreshnessPolicy(policy: FreshnessPolicy): FreshnessPolicy {
  if (policy.freshForMs < 0n || policy.staleAfterMs < 0n) {
    throw new Error('Freshness policy thresholds must be non-negative');
  }

  if (policy.freshForMs > policy.staleAfterMs) {
    throw new Error('freshForMs must be less than or equal to staleAfterMs');
  }

  return policy;
}

export function analyzeDataFreshness({
  lastUpdatedAtMs,
  nowMs,
  policy,
}: AnalyzeDataFreshnessInput): DataFreshnessModel {
  const normalizedNowMs = toMsBigInt(nowMs);
  const normalizedLastUpdatedAtMs = lastUpdatedAtMs === null || lastUpdatedAtMs === undefined ? null : toMsBigInt(lastUpdatedAtMs);

  if (normalizedLastUpdatedAtMs === null) {
    return {
      ageMs: null,
      freshForMs: policy.freshForMs,
      isFresh: false,
      isStale: false,
      isUnknown: true,
      lastUpdatedAtMs: null,
      nowMs: normalizedNowMs,
      severity: 'neutral',
      staleAfterMs: policy.staleAfterMs,
      status: 'UNKNOWN',
    };
  }

  const ageMs = maxBigInt(0n, normalizedNowMs - normalizedLastUpdatedAtMs);
  const status = getFreshnessStatus(ageMs, policy);

  return {
    ageMs,
    freshForMs: policy.freshForMs,
    isFresh: status === 'FRESH',
    isStale: status === 'STALE',
    isUnknown: false,
    lastUpdatedAtMs: normalizedLastUpdatedAtMs,
    nowMs: normalizedNowMs,
    severity: getFreshnessSeverity(status),
    staleAfterMs: policy.staleAfterMs,
    status,
  };
}

export function combineFreshnessStatus(statuses: DataFreshnessStatus[]): DataFreshnessStatus {
  if (statuses.includes('STALE')) {
    return 'STALE';
  }

  if (statuses.includes('UNKNOWN')) {
    return 'UNKNOWN';
  }

  if (statuses.includes('DELAYED')) {
    return 'DELAYED';
  }

  return 'FRESH';
}

export function getFreshnessSeverity(status: DataFreshnessStatus): DataFreshnessSeverity {
  switch (status) {
    case 'FRESH':
      return 'success';
    case 'DELAYED':
      return 'warning';
    case 'STALE':
      return 'danger';
    case 'UNKNOWN':
      return 'neutral';
  }
}

function getFreshnessStatus(ageMs: bigint, policy: FreshnessPolicy): DataFreshnessStatus {
  if (ageMs <= policy.freshForMs) {
    return 'FRESH';
  }

  if (ageMs <= policy.staleAfterMs) {
    return 'DELAYED';
  }

  return 'STALE';
}

function toMsBigInt(value: bigint | number) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Expected a safe millisecond integer, received: ${value}`);
  }

  return BigInt(value);
}

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}
