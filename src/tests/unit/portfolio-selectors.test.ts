import { describe, expect, it } from 'vitest';
import {
  normalizeManagerPositionsSummary,
  selectManagerSummary,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type {
  BinaryPositionSummaryModel,
  ManagerPositionsSummaryModel,
  ManagerSummaryModel,
  RangePositionModel,
} from '@/types/portfolio';

const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const secondOracleId =
  '0xa12da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238e' as ObjectId;
const predictId = '0x49c25811456d931d4276ec2719f0bbfa9c3b977899f77879d3fcaf4e62864f3f' as ObjectId;
const quoteAsset =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC' as const;

function positionsSummary(
  overrides: Partial<ManagerPositionsSummaryModel> = {},
): ManagerPositionsSummaryModel {
  return {
    binaryPositions: [],
    managerId,
    rangePositions: [],
    ...overrides,
  };
}

function binaryPosition(
  overrides: Partial<BinaryPositionSummaryModel> = {},
): BinaryPositionSummaryModel {
  return {
    averageEntryPrice1e9: 420_000_000n,
    averageExitPrice1e9: undefined,
    firstMintedAtMs: 1_781_000_000_000n,
    key: {
      direction: 'UP',
      expiryMs: 1_781_641_800_000n,
      oracleId,
      strike1e9: 50_000_000_000_000n,
    },
    lastActivityAtMs: 1_781_010_000_000n,
    managerId,
    markPrice1e9: 450_000_000n,
    markValueQuote: 450n,
    mintedQuantityQuote: 1_000n,
    openCostBasisQuote: 420n,
    openQuantityQuote: 1_000n,
    predictId,
    quantityQuote: 1_000n,
    quoteAssetType: quoteAsset,
    realizedPnlQuote: 0n,
    redeemedQuantityQuote: 0n,
    status: 'OPEN',
    totalCostQuote: 420n,
    totalPayoutQuote: 0n,
    underlyingAsset: 'BTC',
    unrealizedPnlQuote: 30n,
    ...overrides,
  };
}

function rangePosition(overrides: Partial<RangePositionModel> = {}): RangePositionModel {
  return {
    averageEntryQuote: 120n,
    key: {
      expiryMs: 1_781_641_800_000n,
      higherStrike1e9: 55_000_000_000_000n,
      lowerStrike1e9: 50_000_000_000_000n,
      oracleId,
    },
    quantityQuote: 300n,
    unrealizedPnlQuote: 12n,
    ...overrides,
  };
}

function managerSummary(overrides: Partial<ManagerSummaryModel> = {}): ManagerSummaryModel {
  return {
    accountValueQuote: 1_250n,
    awaitingSettlementPositions: 1,
    balances: [
      {
        balanceQuote: 700n,
        quoteAssetType: quoteAsset,
      },
      {
        balanceQuote: 50n,
        quoteAssetType: quoteAsset,
      },
    ],
    lastRefreshedAtMs: null,
    managerId,
    openExposureQuote: 420n,
    openPositions: 2,
    owner,
    realizedPnlQuote: 20n,
    redeemableValueQuote: 100n,
    tradingBalanceQuote: 750n,
    unrealizedPnlQuote: 80n,
    ...overrides,
  };
}

describe('portfolio selectors', () => {
  it('returns an empty normalized positions state', () => {
    const normalized = normalizeManagerPositionsSummary(positionsSummary());

    expect(normalized).toMatchObject({
      binaryGroups: [],
      binaryPositionCount: 0,
      isEmpty: true,
      managerId,
      openBinaryPositionCount: 0,
      openRangePositionCount: 0,
      rangeGroups: [],
      rangePositionCount: 0,
      totalOpenBinaryQuantityQuote: 0n,
      totalOpenRangeQuantityQuote: 0n,
    });
  });

  it('groups binary positions by oracle and expiry', () => {
    const normalized = normalizeManagerPositionsSummary(
      positionsSummary({
        binaryPositions: [
          binaryPosition({ openQuantityQuote: 1_000n }),
          binaryPosition({
            key: {
              direction: 'DOWN',
              expiryMs: 1_781_641_800_000n,
              oracleId,
              strike1e9: 51_000_000_000_000n,
            },
            markValueQuote: 200n,
            openQuantityQuote: 500n,
            unrealizedPnlQuote: -20n,
          }),
          binaryPosition({
            key: {
              direction: 'UP',
              expiryMs: 1_781_728_200_000n,
              oracleId: secondOracleId,
              strike1e9: 60_000_000_000_000n,
            },
            openQuantityQuote: 200n,
            underlyingAsset: 'ETH',
          }),
        ],
      }),
    );

    expect(normalized.binaryGroups).toHaveLength(2);
    expect(normalized.binaryGroups[0]).toMatchObject({
      directions: ['DOWN', 'UP'],
      markValueQuote: 650n,
      openQuantityQuote: 1_500n,
      oracleId,
      positionCount: 2,
      strikes1e9: [50_000_000_000_000n, 51_000_000_000_000n],
      underlyingAsset: 'BTC',
      unrealizedPnlQuote: 10n,
    });
    expect(normalized.totalOpenBinaryQuantityQuote).toBe(1_700n);
  });

  it('preserves multiple directions and strikes inside a binary group', () => {
    const normalized = normalizeManagerPositionsSummary(
      positionsSummary({
        binaryPositions: [
          binaryPosition({
            key: {
              direction: 'DOWN',
              expiryMs: 1_781_641_800_000n,
              oracleId,
              strike1e9: 52_000_000_000_000n,
            },
          }),
          binaryPosition(),
        ],
      }),
    );

    expect(normalized.binaryGroups[0]?.positions.map((position) => position.key.direction)).toEqual(
      ['UP', 'DOWN'],
    );
    expect(normalized.binaryGroups[0]?.strikes1e9).toEqual([
      50_000_000_000_000n,
      52_000_000_000_000n,
    ]);
  });

  it('keeps range positions separate from binary position groups', () => {
    const normalized = normalizeManagerPositionsSummary(
      positionsSummary({
        binaryPositions: [binaryPosition()],
        rangePositions: [rangePosition()],
      }),
    );

    expect(normalized.binaryGroups).toHaveLength(1);
    expect(normalized.rangeGroups).toHaveLength(1);
    expect(normalized.rangeGroups[0]).toMatchObject({
      oracleId,
      positionCount: 1,
      totalQuantityQuote: 300n,
    });
    expect(normalized.totalOpenBinaryQuantityQuote).toBe(1_000n);
    expect(normalized.totalOpenRangeQuantityQuote).toBe(300n);
  });

  it('keeps manager balances separate from any wallet balance concept', () => {
    const selected = selectManagerSummary(managerSummary());

    expect(selected.balanceSummary.totalManagerBalanceQuote).toBe(750n);
    expect(selected.balanceSummary.tradingBalanceQuote).toBe(750n);
    expect(selected.balanceSummary.accountValueQuote).toBe(1_250n);
    expect('walletDusdcQuote' in selected.balanceSummary).toBe(false);
  });
});
