import { describe, expect, it } from 'vitest';
import {
  analyzeDataFreshness,
  combineFreshnessStatus,
  createFreshnessPolicy,
  getFreshnessSeverity,
} from '@/lib/freshness';

const policy = createFreshnessPolicy({
  freshForMs: 5_000n,
  staleAfterMs: 15_000n,
});

describe('data freshness utilities', () => {
  it('classifies fresh, delayed, and stale timestamps', () => {
    expect(
      analyzeDataFreshness({
        lastUpdatedAtMs: 95_000n,
        nowMs: 100_000n,
        policy,
      }).status,
    ).toBe('FRESH');
    expect(
      analyzeDataFreshness({
        lastUpdatedAtMs: 90_000n,
        nowMs: 100_000n,
        policy,
      }).status,
    ).toBe('DELAYED');
    expect(
      analyzeDataFreshness({
        lastUpdatedAtMs: 84_999n,
        nowMs: 100_000n,
        policy,
      }).status,
    ).toBe('STALE');
  });

  it('classifies missing timestamps as unknown', () => {
    const freshness = analyzeDataFreshness({
      lastUpdatedAtMs: null,
      nowMs: 100_000n,
      policy,
    });

    expect(freshness).toMatchObject({
      ageMs: null,
      isFresh: false,
      isStale: false,
      isUnknown: true,
      severity: 'neutral',
      status: 'UNKNOWN',
    });
  });

  it('clamps future timestamps to zero age for clock skew tolerance', () => {
    const freshness = analyzeDataFreshness({
      lastUpdatedAtMs: 101_000n,
      nowMs: 100_000n,
      policy,
    });

    expect(freshness.ageMs).toBe(0n);
    expect(freshness.status).toBe('FRESH');
  });

  it('combines statuses by most restrictive freshness state', () => {
    expect(combineFreshnessStatus(['FRESH', 'DELAYED'])).toBe('DELAYED');
    expect(combineFreshnessStatus(['FRESH', 'UNKNOWN'])).toBe('UNKNOWN');
    expect(combineFreshnessStatus(['UNKNOWN', 'STALE'])).toBe('STALE');
  });

  it('maps freshness states to semantic severities', () => {
    expect(getFreshnessSeverity('FRESH')).toBe('success');
    expect(getFreshnessSeverity('DELAYED')).toBe('warning');
    expect(getFreshnessSeverity('STALE')).toBe('danger');
    expect(getFreshnessSeverity('UNKNOWN')).toBe('neutral');
  });

  it('rejects invalid threshold policies', () => {
    expect(() => createFreshnessPolicy({ freshForMs: -1n, staleAfterMs: 1n })).toThrow(
      /non-negative/,
    );
    expect(() => createFreshnessPolicy({ freshForMs: 10n, staleAfterMs: 1n })).toThrow(
      /less than or equal/,
    );
  });
});
