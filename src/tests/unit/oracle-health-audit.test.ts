import { describe, expect, it } from 'vitest';
import { createOracleHealthAudit } from '@/features/oracle/lib/oracle-health-audit';
import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';
const objectId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';
const nowMs = 100_000n;

interface OracleFixtureOptions {
  askBoundsStatus?: 'PRESENT_UNMAPPED' | 'UNAVAILABLE';
  expiryMs?: bigint;
  latestPriceAtMs?: bigint | null;
  latestSviAtMs?: bigint | null;
  lifecycleStatus?: OracleLifecycleStatus;
  minStrike1e9?: bigint;
  settlementPrice1e9?: bigint | null;
  tickSize1e9?: bigint;
}

function createOracleState({
  askBoundsStatus = 'UNAVAILABLE',
  expiryMs = 200_000n,
  latestPriceAtMs = 98_000n,
  latestSviAtMs = 90_000n,
  lifecycleStatus = 'ACTIVE',
  minStrike1e9 = 50_000_000_000_000n,
  settlementPrice1e9 = null,
  tickSize1e9 = 1_000_000_000n,
}: OracleFixtureOptions = {}): OracleStateModel {
  return {
    askBounds: { status: askBoundsStatus },
    latestPrice:
      latestPriceAtMs === null
        ? null
        : {
            checkpoint: 1n,
            checkpointTimestampMs: latestPriceAtMs,
            digest: 'price-digest',
            eventDigest: 'price-event',
            eventIndex: 0,
            forward1e9: 65_000_000_000_000n,
            onchainTimestampMs: latestPriceAtMs,
            oracleId,
            packageId: objectId,
            sender,
            spot1e9: 65_000_000_000_000n,
            txIndex: 0,
          },
    latestSvi:
      latestSviAtMs === null
        ? null
        : {
            checkpoint: 1n,
            checkpointTimestampMs: latestSviAtMs,
            digest: 'svi-digest',
            eventDigest: 'svi-event',
            eventIndex: 0,
            onchainTimestampMs: latestSviAtMs,
            oracleId,
            packageId: objectId,
            sender,
            svi: {
              a1e9: 1n,
              b1e9: 1n,
              m1e9Signed: 0n,
              rho1e9Signed: 0n,
              sigma1e9: 1n,
            },
            txIndex: 0,
          },
    oracle: {
      activatedAtMs: 1n,
      createdCheckpoint: 1n,
      expiryMs,
      lifecycleStatus,
      minStrike1e9,
      oracleCapId: objectId,
      oracleId,
      predictId,
      settledAtMs: lifecycleStatus === 'SETTLED' ? 99_000n : null,
      settlementPrice1e9,
      tickSize1e9,
      underlyingAsset: 'BTC',
    },
  };
}

describe('oracle health audit', () => {
  it('marks an active fresh future oracle as non-blocked while surfacing bounds caution', () => {
    const audit = createOracleHealthAudit({
      askBounds: { status: 'PRESENT_UNMAPPED' },
      nowMs,
      oracleState: createOracleState({ askBoundsStatus: 'PRESENT_UNMAPPED' }),
      selection: {
        direction: 'UP',
        kind: 'binary',
        strike1e9: 50_000_000_000_000n,
      },
    });

    expect(audit.status).toBe('CAUTION');
    expect(audit.checks.find((check) => check.label === 'Lifecycle')).toMatchObject({
      status: 'pass',
    });
    expect(audit.checks.find((check) => check.label === 'Ask bounds')).toMatchObject({
      status: 'caution',
    });
    expect(audit.checks.find((check) => check.label === 'Binary strike')).toMatchObject({
      status: 'pass',
    });
  });

  it.each([
    ['inactive oracle', { lifecycleStatus: 'INACTIVE' as const }],
    ['pending settlement oracle', { lifecycleStatus: 'PENDING_SETTLEMENT' as const }],
    ['settled oracle for mint', { lifecycleStatus: 'SETTLED' as const, settlementPrice1e9: 1n }],
    ['expired oracle', { expiryMs: nowMs }],
    ['stale price', { latestPriceAtMs: 70_000n }],
    ['missing price', { latestPriceAtMs: null }],
    ['missing SVI', { latestSviAtMs: null }],
  ])('blocks %s', (_label, options) => {
    const audit = createOracleHealthAudit({
      nowMs,
      oracleState: createOracleState(options),
    });

    expect(audit.status).toBe('BLOCKED');
    expect(audit.checks.some((check) => check.status === 'blocked')).toBe(true);
  });

  it('surfaces delayed freshness, near expiry, and ask-bounds as cautions', () => {
    const audit = createOracleHealthAudit({
      nowMs,
      oracleState: createOracleState({
        expiryMs: nowMs + 10n * 60n * 1_000n,
        latestPriceAtMs: 92_000n,
        latestSviAtMs: 70_000n,
      }),
    });

    expect(audit.status).toBe('CAUTION');
    expect(audit.checks.find((check) => check.label === 'Price freshness')).toMatchObject({
      status: 'caution',
    });
    expect(audit.checks.find((check) => check.label === 'SVI freshness')).toMatchObject({
      status: 'caution',
    });
    expect(audit.checks.find((check) => check.label === 'Expiry')).toMatchObject({
      status: 'caution',
    });
  });

  it('blocks invalid binary strike and invalid range selection', () => {
    const oracleState = createOracleState();
    const invalidBinary = createOracleHealthAudit({
      nowMs,
      oracleState,
      selection: {
        direction: 'UP',
        kind: 'binary',
        strike1e9: oracleState.oracle.minStrike1e9 + 1n,
      },
    });
    const invalidRange = createOracleHealthAudit({
      nowMs,
      oracleState,
      selection: {
        higherStrike1e9: oracleState.oracle.minStrike1e9,
        kind: 'range',
        lowerStrike1e9: oracleState.oracle.minStrike1e9,
      },
    });

    expect(invalidBinary.status).toBe('BLOCKED');
    expect(invalidBinary.checks.find((check) => check.label === 'Binary strike')).toMatchObject({
      status: 'blocked',
    });
    expect(invalidRange.status).toBe('BLOCKED');
    expect(invalidRange.checks.find((check) => check.label === 'Range strikes')).toMatchObject({
      status: 'blocked',
    });
  });

  it('returns unknown when oracle state is unavailable', () => {
    const audit = createOracleHealthAudit({ nowMs, oracleState: null });

    expect(audit.status).toBe('UNKNOWN');
    expect(audit.title).toBe('Audit unavailable');
    expect(audit.checks).toEqual([
      expect.objectContaining({
        label: 'Oracle state',
        status: 'unknown',
      }),
    ]);
  });
});
