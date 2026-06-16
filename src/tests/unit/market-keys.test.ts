import { describe, expect, it } from 'vitest';
import { buildBinaryMarketKey, buildRangeKey } from '@/features/markets/lib/market-keys';
import type { OracleSummaryModel } from '@/types/oracle';
import type { ObjectId } from '@/types/predict';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a' as ObjectId;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;

const oracle: OracleSummaryModel = {
  activatedAtMs: 1_781_634_686_445n,
  createdCheckpoint: 349_219_640n,
  expiryMs: 1_781_641_800_000n,
  lifecycleStatus: 'ACTIVE',
  minStrike1e9: 50_000_000_000_000n,
  oracleCapId: '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817',
  oracleId,
  predictId,
  settlementPrice1e9: null,
  settledAtMs: null,
  tickSize1e9: 1_000_000_000n,
  underlyingAsset: 'BTC',
};

describe('market key helpers', () => {
  it('builds a valid UP binary market key', () => {
    const result = buildBinaryMarketKey({
      direction: 'UP',
      oracle,
      strike1e9: 65_000_000_000_000n,
    });

    expect(result).toEqual({
      key: {
        direction: 'UP',
        expiryMs: oracle.expiryMs,
        oracleId,
        strike1e9: 65_000_000_000_000n,
      },
      ok: true,
      warnings: [],
    });
  });

  it('builds a valid DOWN binary market key from integer-like string input', () => {
    const result = buildBinaryMarketKey({
      direction: 'DOWN',
      oracle,
      strike1e9: '65000000000000',
    });

    expect(result).toMatchObject({
      key: {
        direction: 'DOWN',
        strike1e9: 65_000_000_000_000n,
      },
      ok: true,
    });
  });

  it('builds a valid range key', () => {
    const result = buildRangeKey({
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracle,
    });

    expect(result).toEqual({
      key: {
        expiryMs: oracle.expiryMs,
        higherStrike1e9: 70_000_000_000_000n,
        lowerStrike1e9: 62_000_000_000_000n,
        oracleId,
      },
      ok: true,
      warnings: [],
    });
  });

  it('rejects a strike below the oracle minimum', () => {
    const result = buildBinaryMarketKey({
      direction: 'UP',
      oracle,
      strike1e9: 49_000_000_000_000n,
    });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'STRIKE_BELOW_MINIMUM',
          field: 'strike1e9',
        },
      ],
      ok: false,
    });
  });

  it('rejects a strike that is not aligned to the oracle tick size', () => {
    const result = buildBinaryMarketKey({
      direction: 'UP',
      oracle,
      strike1e9: 65_000_000_000_001n,
    });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'STRIKE_NOT_ON_TICK',
          field: 'strike1e9',
        },
      ],
      ok: false,
    });
  });

  it('rejects range keys where lower strike is not below higher strike', () => {
    const result = buildRangeKey({
      higherStrike1e9: 62_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracle,
    });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'RANGE_ORDER_INVALID',
          field: 'higherStrike1e9',
        },
      ],
      ok: false,
    });
  });

  it('preserves unavailable ask-bounds as a warning without rejecting a valid key', () => {
    const result = buildBinaryMarketKey({
      askBounds: { status: 'UNAVAILABLE' },
      direction: 'UP',
      oracle,
      strike1e9: 65_000_000_000_000n,
    });

    expect(result).toMatchObject({
      ok: true,
      warnings: [
        {
          code: 'ASK_BOUNDS_UNAVAILABLE',
        },
      ],
    });
  });

  it('preserves present-but-unmapped ask-bounds as a TODO VERIFY warning', () => {
    const result = buildRangeKey({
      askBounds: { status: 'PRESENT_UNMAPPED' },
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracle,
    });

    expect(result).toMatchObject({
      ok: true,
      warnings: [
        {
          code: 'ASK_BOUNDS_PRESENT_UNMAPPED',
        },
      ],
    });
  });
});
