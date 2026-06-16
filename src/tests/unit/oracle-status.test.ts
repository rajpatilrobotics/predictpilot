import { describe, expect, it } from 'vitest';
import { getOracleStatus } from '@/lib/oracle-status';
import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';
const objectId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';

interface OracleFixtureOptions {
  expiryMs?: bigint;
  latestPriceAtMs?: bigint | null;
  latestSviAtMs?: bigint | null;
  lifecycleStatus?: OracleLifecycleStatus;
  settlementPrice1e9?: bigint | null;
}

function createOracleState({
  expiryMs = 200_000n,
  latestPriceAtMs = 96_000n,
  latestSviAtMs = 90_000n,
  lifecycleStatus = 'ACTIVE',
  settlementPrice1e9 = null,
}: OracleFixtureOptions = {}): OracleStateModel {
  return {
    askBounds: { status: 'UNAVAILABLE' },
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
      minStrike1e9: 1n,
      oracleCapId: objectId,
      oracleId,
      predictId,
      settledAtMs: lifecycleStatus === 'SETTLED' ? 99_000n : null,
      settlementPrice1e9,
      tickSize1e9: 1n,
      underlyingAsset: 'BTC',
    },
  };
}

describe('oracle status utilities', () => {
  it('marks active fresh oracle state as mintable and redeemable', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState(),
    });

    expect(status.isLive).toBe(true);
    expect(status.freshness.aggregateStatus).toBe('FRESH');
    expect(status.mint).toMatchObject({
      isAllowed: true,
      reasonCodes: ['ORACLE_ACTIVE'],
      requiresAuthoritativeRefresh: false,
      status: 'AVAILABLE',
    });
    expect(status.redeem.isAllowed).toBe(true);
  });

  it('marks delayed oracle state as warning while requiring refresh before signing', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        latestPriceAtMs: 91_000n,
        latestSviAtMs: 70_000n,
      }),
    });

    expect(status.freshness.aggregateStatus).toBe('DELAYED');
    expect(status.mint).toMatchObject({
      isAllowed: true,
      reasonCodes: ['ORACLE_DELAYED'],
      requiresAuthoritativeRefresh: true,
      status: 'WARNING',
    });
  });

  it('blocks mint and redeem when active oracle data is stale', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        latestPriceAtMs: 80_000n,
      }),
    });

    expect(status.freshness.aggregateStatus).toBe('STALE');
    expect(status.mint).toMatchObject({
      isAllowed: false,
      status: 'BLOCKED',
    });
    expect(status.mint.reasonCodes).toContain('ORACLE_STALE');
    expect(status.redeem.isAllowed).toBe(false);
  });

  it('blocks mint when price or SVI data is missing', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        latestPriceAtMs: null,
        latestSviAtMs: null,
      }),
    });

    expect(status.freshness.aggregateStatus).toBe('UNKNOWN');
    expect(status.mint.isAllowed).toBe(false);
    expect(status.mint.reasonCodes).toEqual(['ORACLE_PRICE_MISSING', 'ORACLE_SVI_MISSING']);
  });

  it('blocks mint on inactive and pending-settlement oracle lifecycle states', () => {
    const inactive = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({ lifecycleStatus: 'INACTIVE' }),
    });
    const pendingSettlement = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({ lifecycleStatus: 'PENDING_SETTLEMENT' }),
    });

    expect(inactive.mint.reasonCodes).toContain('ORACLE_INACTIVE');
    expect(inactive.mint.isAllowed).toBe(false);
    expect(pendingSettlement.mint.reasonCodes).toContain('ORACLE_PENDING_SETTLEMENT');
    expect(pendingSettlement.mint.isAllowed).toBe(false);
  });

  it('blocks mint when expiry has passed even if indexed lifecycle still says active', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        expiryMs: 100_000n,
      }),
    });

    expect(status.expiryStatus).toBe('EXPIRED');
    expect(status.isLive).toBe(false);
    expect(status.mint.reasonCodes).toContain('ORACLE_EXPIRED');
    expect(status.mint.isAllowed).toBe(false);
  });

  it('blocks mint but allows settled redeem when settlement price is present', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        lifecycleStatus: 'SETTLED',
        settlementPrice1e9: 66_000_000_000_000n,
      }),
    });

    expect(status.mint.reasonCodes).toContain('ORACLE_SETTLED');
    expect(status.mint.isAllowed).toBe(false);
    expect(status.redeem).toMatchObject({
      isAllowed: true,
      reasonCodes: ['SETTLED_REDEEM_AVAILABLE'],
      status: 'AVAILABLE',
    });
  });

  it('blocks settled redeem if settlement price is missing', () => {
    const status = getOracleStatus({
      nowMs: 100_000n,
      oracleState: createOracleState({
        lifecycleStatus: 'SETTLED',
        settlementPrice1e9: null,
      }),
    });

    expect(status.redeem).toMatchObject({
      isAllowed: false,
      reasonCodes: ['SETTLEMENT_PRICE_MISSING'],
      status: 'BLOCKED',
    });
  });
});
