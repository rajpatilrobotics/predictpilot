import { describe, expect, it } from 'vitest';
import {
  getTopBestDemoMarket,
  rankBestDemoMarkets,
  type BestDemoMarketReadiness,
} from '@/features/markets/lib/best-market-finder';
import type {
  OracleAskBoundsModel,
  OracleIndexedPriceModel,
  OracleIndexedSviModel,
  OracleStateModel,
  OracleSummaryModel,
} from '@/types/oracle';
import type { ObjectId, SuiAddress } from '@/types/predict';

const nowMs = 1_781_635_255_000;
const predictId = objectId('01');
const packageId = objectId('02');
const sender: SuiAddress = objectId('03');
const readyReadiness: BestDemoMarketReadiness = {
  hasManagerDusdc: true,
  isManagerReady: true,
  isWalletConnected: true,
  isWalletOnTestnet: true,
};

describe('best market finder ranking', () => {
  it('prefers active, fresh, valid BTC markets over stale or inactive alternatives', () => {
    const btc = createOracle({ idByte: '10', underlyingAsset: 'BTC' });
    const staleEth = createOracle({ idByte: '11', underlyingAsset: 'ETH' });
    const inactiveBtc = createOracle({
      idByte: '12',
      lifecycleStatus: 'INACTIVE',
      underlyingAsset: 'BTC',
    });

    const ranked = rankBestDemoMarkets({
      enrichments: new Map([
        [btc.oracleId, { askBounds: presentAskBounds(), oracleState: createOracleState(btc) }],
        [
          staleEth.oracleId,
          {
            askBounds: presentAskBounds(),
            oracleState: createOracleState(staleEth, { ageMs: 700_000n }),
          },
        ],
      ]),
      nowMs,
      oracles: [staleEth, inactiveBtc, btc],
      readiness: readyReadiness,
    });

    expect(getTopBestDemoMarket(ranked)?.oracleId).toBe(btc.oracleId);
    expect(ranked[0]?.reasons.map((reason) => reason.label)).toContain('Fresh oracle');
    expect(ranked.find((candidate) => candidate.oracleId === staleEth.oracleId)?.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Stale oracle' })]),
    );
    expect(
      ranked.find((candidate) => candidate.oracleId === inactiveBtc.oracleId)
        ?.isEligibleForTopRecommendation,
    ).toBe(false);
  });

  it('does not top-recommend markets with missing oracle timestamps', () => {
    const oracle = createOracle({ idByte: '20', underlyingAsset: 'BTC' });

    const ranked = rankBestDemoMarkets({
      enrichments: new Map([
        [
          oracle.oracleId,
          {
            askBounds: presentAskBounds(),
            oracleState: createOracleState(oracle, { latestPrice: null, latestSvi: null }),
          },
        ],
      ]),
      nowMs,
      oracles: [oracle],
      readiness: readyReadiness,
    });

    expect(getTopBestDemoMarket(ranked)).toBeNull();
    expect(ranked[0]?.warnings.map((warning) => warning.label)).toContain(
      'Missing oracle timestamp',
    );
  });

  it('preserves ask-bounds warnings without claiming numeric bounds are verified', () => {
    const oracle = createOracle({ idByte: '30', underlyingAsset: 'BTC' });

    const ranked = rankBestDemoMarkets({
      enrichments: new Map([
        [
          oracle.oracleId,
          {
            askBounds: { status: 'UNAVAILABLE' },
            oracleState: createOracleState(oracle),
          },
        ],
      ]),
      nowMs,
      oracles: [oracle],
      readiness: readyReadiness,
    });

    expect(ranked[0]?.warnings.map((warning) => warning.label)).toContain('Ask bounds unavailable');
    expect(ranked[0]?.reasons.map((reason) => reason.label)).not.toContain('Ask bounds present');
  });

  it('shows readiness warnings without changing the objective market winner', () => {
    const btc = createOracle({ idByte: '40', underlyingAsset: 'BTC' });
    const eth = createOracle({ idByte: '41', underlyingAsset: 'ETH' });
    const disconnectedReadiness: BestDemoMarketReadiness = {
      hasManagerDusdc: false,
      isManagerReady: false,
      isWalletConnected: false,
      isWalletOnTestnet: true,
    };

    const connectedRanking = rankBestDemoMarkets({
      nowMs,
      oracles: [eth, btc],
      readiness: readyReadiness,
    });
    const disconnectedRanking = rankBestDemoMarkets({
      nowMs,
      oracles: [eth, btc],
      readiness: disconnectedReadiness,
    });

    expect(getTopBestDemoMarket(connectedRanking)?.oracleId).toBe(btc.oracleId);
    expect(getTopBestDemoMarket(disconnectedRanking)?.oracleId).toBe(btc.oracleId);
    expect(disconnectedRanking[0]?.warnings.map((warning) => warning.label)).toEqual(
      expect.arrayContaining(['Wallet not connected', 'Manager needed', 'Fund dUSDC']),
    );
  });

  it('uses oracle ID as a deterministic tie-breaker', () => {
    const laterId = createOracle({ idByte: 'f0', underlyingAsset: 'ETH' });
    const earlierId = createOracle({ idByte: '0f', underlyingAsset: 'ETH' });

    const ranked = rankBestDemoMarkets({
      nowMs,
      oracles: [laterId, earlierId],
      readiness: readyReadiness,
    });

    expect(ranked.map((candidate) => candidate.oracleId)).toEqual([
      earlierId.oracleId,
      laterId.oracleId,
    ]);
  });
});

function createOracle({
  expiryMs = BigInt(nowMs) + 4n * 60n * 60n * 1_000n,
  idByte,
  lifecycleStatus = 'ACTIVE',
  tickSize1e9 = 1_000_000_000n,
  underlyingAsset,
}: {
  expiryMs?: bigint;
  idByte: string;
  lifecycleStatus?: OracleSummaryModel['lifecycleStatus'];
  tickSize1e9?: bigint;
  underlyingAsset: string;
}): OracleSummaryModel {
  return {
    activatedAtMs: BigInt(nowMs - 60_000),
    createdCheckpoint: 100n,
    expiryMs,
    lifecycleStatus,
    minStrike1e9: underlyingAsset === 'BTC' ? 50_000_000_000_000n : 2_000_000_000_000n,
    oracleCapId: objectId(`${idByte}aa`),
    oracleId: objectId(idByte),
    predictId,
    settlementPrice1e9: null,
    settledAtMs: null,
    tickSize1e9,
    underlyingAsset,
  };
}

function createOracleState(
  oracle: OracleSummaryModel,
  overrides: {
    ageMs?: bigint;
    latestPrice?: OracleIndexedPriceModel | null;
    latestSvi?: OracleIndexedSviModel | null;
  } = {},
): OracleStateModel {
  const ageMs = overrides.ageMs ?? 5_000n;

  return {
    askBounds: presentAskBounds(),
    latestPrice:
      overrides.latestPrice === undefined
        ? createPrice(oracle.oracleId, ageMs)
        : overrides.latestPrice,
    latestSvi:
      overrides.latestSvi === undefined ? createSvi(oracle.oracleId, ageMs) : overrides.latestSvi,
    oracle,
  };
}

function createPrice(oracleId: ObjectId, ageMs: bigint): OracleIndexedPriceModel {
  return {
    checkpoint: 10n,
    checkpointTimestampMs: BigInt(nowMs) - ageMs,
    digest: `price-${oracleId}`,
    eventDigest: `price-event-${oracleId}`,
    eventIndex: 0,
    forward1e9: 50_250_000_000_000n,
    onchainTimestampMs: BigInt(nowMs) - ageMs,
    oracleId,
    packageId,
    sender,
    spot1e9: 50_000_000_000_000n,
    txIndex: 0,
  };
}

function createSvi(oracleId: ObjectId, ageMs: bigint): OracleIndexedSviModel {
  return {
    checkpoint: 11n,
    checkpointTimestampMs: BigInt(nowMs) - ageMs,
    digest: `svi-${oracleId}`,
    eventDigest: `svi-event-${oracleId}`,
    eventIndex: 1,
    onchainTimestampMs: BigInt(nowMs) - ageMs,
    oracleId,
    packageId,
    sender,
    svi: {
      a1e9: 1n,
      b1e9: 2n,
      m1e9Signed: -3n,
      rho1e9Signed: -4n,
      sigma1e9: 5n,
    },
    txIndex: 1,
  };
}

function presentAskBounds(): OracleAskBoundsModel {
  return { status: 'PRESENT_UNMAPPED' };
}

function objectId(seed: string): ObjectId {
  const normalizedSeed = seed.replace(/[^a-fA-F0-9]/g, '').slice(0, 64);

  return `0x${normalizedSeed.padStart(64, '0')}`;
}
