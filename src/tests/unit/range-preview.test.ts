import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getRangePreviewActionCopy,
  getRangePreviewAmountCopy,
  getRangePreviewBandCopy,
  getRangePreviewPrimaryAmount,
  getRangePreviewWarningCount,
} from '@/features/trade/lib/range-preview';
import {
  previewRangeTrade,
  type RangeTradeAmountEstimator,
  type RangeTradeAmountEstimatorInput,
} from '@/integrations/deepbook-predict/tx/preview-range';
import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import type { ManagerSummaryModel, RangePositionModel } from '@/types/portfolio';

const predictId = predictDeploymentConfig.predictObjectId;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const oracleCapId =
  '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817' as ObjectId;
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const nowMs = 100_000n;

const validQuantity = 100_000n as QuoteAmount;
const validLowerStrike = 64_000_000_000_000n;
const validHigherStrike = 66_000_000_000_000n;

function createManager(overrides: Partial<ManagerSummaryModel> = {}): ManagerSummaryModel {
  return {
    accountValueQuote: 3_000_000n,
    awaitingSettlementPositions: 0,
    balances: [
      {
        balanceQuote: 2_000_000n,
        quoteAssetType: predictDeploymentConfig.quoteAsset.type,
      },
    ],
    lastRefreshedAtMs: 99_000n,
    managerId,
    openExposureQuote: 0n,
    openPositions: 1,
    owner: sender,
    realizedPnlQuote: 0n,
    redeemableValueQuote: 0n,
    tradingBalanceQuote: 2_000_000n,
    unrealizedPnlQuote: 0n,
    ...overrides,
  };
}

function createOracleState({
  askBounds = { status: 'UNAVAILABLE' },
  expiryMs = 200_000n,
  latestPriceAtMs = 96_000n,
  latestSviAtMs = 90_000n,
  lifecycleStatus = 'ACTIVE',
  settlementPrice1e9 = null,
}: {
  askBounds?: OracleStateModel['askBounds'];
  expiryMs?: bigint;
  latestPriceAtMs?: bigint | null;
  latestSviAtMs?: bigint | null;
  lifecycleStatus?: OracleLifecycleStatus;
  settlementPrice1e9?: bigint | null;
} = {}): OracleStateModel {
  return {
    askBounds,
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
            packageId: predictDeploymentConfig.packageId,
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
            packageId: predictDeploymentConfig.packageId,
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
      minStrike1e9: 50_000_000_000_000n,
      oracleCapId,
      oracleId,
      predictId,
      settledAtMs: lifecycleStatus === 'SETTLED' ? 99_000n : null,
      settlementPrice1e9,
      tickSize1e9: 1_000_000_000n,
      underlyingAsset: 'BTC',
    },
  };
}

function createOwnedRangePosition(overrides: Partial<RangePositionModel> = {}): RangePositionModel {
  return {
    averageEntryQuote: 10_000n,
    key: {
      expiryMs: 200_000n,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      oracleId,
    },
    quantityQuote: 200_000n,
    unrealizedPnlQuote: 0n,
    ...overrides,
  };
}

function mintRangeEstimator(costQuote: QuoteAmount = 250_000n): RangeTradeAmountEstimator {
  return vi.fn((input: RangeTradeAmountEstimatorInput) => ({
    action: 'MINT_RANGE' as const,
    estimatedCostQuote: costQuote,
    isVerified: true,
    requiresAuthoritativeRefresh: false,
    source: `mock-${input.action.toLowerCase()}`,
  }));
}

function redeemRangeEstimator(payoutQuote: QuoteAmount = 125_000n): RangeTradeAmountEstimator {
  return vi.fn((input: RangeTradeAmountEstimatorInput) => ({
    action: 'REDEEM_RANGE' as const,
    estimatedPayoutQuote: payoutQuote,
    isVerified: true,
    requiresAuthoritativeRefresh: false,
    source: `mock-${input.action.toLowerCase()}`,
  }));
}

describe('previewRangeTrade', () => {
  it('builds a successful range mint preview with fresh oracle state and manager balance', async () => {
    const estimator = mintRangeEstimator();
    const result = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(estimator).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MINT_RANGE',
        quantityQuote: validQuantity,
        rangeKey: {
          expiryMs: 200_000n,
          higherStrike1e9: validHigherStrike,
          lowerStrike1e9: validLowerStrike,
          oracleId,
        },
      }),
    );
    expect(result.preview).toMatchObject({
      action: 'MINT_RANGE',
      estimatedCostQuote: 250_000n,
      estimateSource: 'mock-mint_range',
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      managerBalanceQuote: 2_000_000n,
      managerId,
      oracleId,
      quantityQuote: validQuantity,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      requiresAuthoritativeRefresh: false,
      underlyingAsset: 'BTC',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(getRangePreviewActionCopy(result.preview)).toBe('Mint range position');
    expect(getRangePreviewPrimaryAmount(result.preview)).toEqual({
      amountQuote: 250_000n,
      label: 'Estimated cost',
    });
    expect(getRangePreviewAmountCopy(result.preview)).toBe('Estimated cost: 250000 DUSDC');
    expect(getRangePreviewBandCopy(result.preview)).toBe(
      `${validLowerStrike.toString()} - ${validHigherStrike.toString()}`,
    );
  });

  it('builds a successful range redeem preview with owned quantity', async () => {
    const result = await previewRangeTrade({
      action: 'REDEEM_RANGE',
      estimateTradeAmounts: redeemRangeEstimator(),
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      ownedRangePosition: createOwnedRangePosition(),
      quantityQuote: validQuantity,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'REDEEM_RANGE',
      estimatedPayoutQuote: 125_000n,
      estimateSource: 'mock-redeem_range',
      requiresAuthoritativeRefresh: false,
    });
    expect(getRangePreviewPrimaryAmount(result.preview)).toEqual({
      amountQuote: 125_000n,
      label: 'Estimated payout',
    });
    expect(getRangePreviewWarningCount(result.preview.warnings)).toBe(1);
  });

  it('blocks zero or negative quantity before estimation', async () => {
    const estimator = mintRangeEstimator();
    const zero = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: 0n,
    });
    const negative = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: -1n,
    });

    expect(zero).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quantityQuote',
        },
      },
      ok: false,
    });
    expect(negative).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quantityQuote',
        },
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks invalid ranges and strike inputs through the range-key helper', async () => {
    const estimator = mintRangeEstimator();
    const reversed = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validLowerStrike,
      lowerStrike1e9: validHigherStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });
    const sameStrike = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validLowerStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });
    const belowMinimum = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: 49_000_000_000_000n,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(reversed).toMatchObject({
      error: {
        code: 'INVALID_RANGE',
        context: {
          errors: ['RANGE_ORDER_INVALID'],
          field: 'rangeKey',
        },
      },
      ok: false,
    });
    expect(sameStrike).toMatchObject({
      error: {
        code: 'INVALID_RANGE',
        context: {
          errors: ['RANGE_ORDER_INVALID'],
          field: 'rangeKey',
        },
      },
      ok: false,
    });
    expect(belowMinimum).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          errors: ['STRIKE_BELOW_MINIMUM'],
          field: 'rangeKey',
        },
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks missing manager before estimation', async () => {
    const estimator = mintRangeEstimator();
    const result = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: null,
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(result).toMatchObject({
      error: {
        code: 'MANAGER_NOT_FOUND',
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks stale oracle state before estimation', async () => {
    const estimator = mintRangeEstimator();
    const result = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({
        latestPriceAtMs: 80_000n,
      }),
      quantityQuote: validQuantity,
    });

    expect(result).toMatchObject({
      error: {
        code: 'ORACLE_STALE',
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks inactive and settled range mint previews before estimation', async () => {
    const estimator = mintRangeEstimator();
    const inactive = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ lifecycleStatus: 'INACTIVE' }),
      quantityQuote: validQuantity,
    });
    const settled = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({
        lifecycleStatus: 'SETTLED',
        settlementPrice1e9: validLowerStrike,
      }),
      quantityQuote: validQuantity,
    });

    expect(inactive).toMatchObject({
      error: {
        code: 'ORACLE_NOT_TRADEABLE',
      },
      ok: false,
    });
    expect(settled).toMatchObject({
      error: {
        code: 'ORACLE_NOT_TRADEABLE',
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks mint when estimated cost exceeds manager DUSDC balance', async () => {
    const result = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: mintRangeEstimator(3_000_000n),
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INSUFFICIENT_MANAGER_DUSDC',
      },
      ok: false,
    });
  });

  it('blocks redeem when requested quantity exceeds owned range quantity', async () => {
    const estimator = redeemRangeEstimator();
    const result = await previewRangeTrade({
      action: 'REDEEM_RANGE',
      estimateTradeAmounts: estimator,
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      ownedRangePosition: createOwnedRangePosition({ quantityQuote: 50_000n }),
      quantityQuote: validQuantity,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quantityQuote',
        },
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('preserves ask-bounds warnings for unavailable and present-unmapped states', async () => {
    const unavailable = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: mintRangeEstimator(),
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ askBounds: { status: 'UNAVAILABLE' } }),
      quantityQuote: validQuantity,
    });
    const unmapped = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: mintRangeEstimator(),
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ askBounds: { status: 'PRESENT_UNMAPPED' } }),
      quantityQuote: validQuantity,
    });

    expect(unavailable.ok && unavailable.preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ASK_BOUNDS_UNAVAILABLE',
        }),
      ]),
    );
    expect(unmapped.ok && unmapped.preview.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ASK_BOUNDS_PRESENT_UNMAPPED',
        }),
      ]),
    );
  });

  it('fails safely when no verified estimator is available', async () => {
    const missing = await previewRangeTrade({
      action: 'MINT_RANGE',
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });
    const unverified = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: () => ({
        action: 'MINT_RANGE',
        estimatedCostQuote: 250_000n,
        isVerified: false,
        requiresAuthoritativeRefresh: false,
        source: 'unverified-local-estimate',
      }),
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(missing).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
      },
      ok: false,
    });
    expect(unverified).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
      },
      ok: false,
    });
  });

  it('maps estimator failures to simulation errors without fake amounts', async () => {
    const result = await previewRangeTrade({
      action: 'MINT_RANGE',
      estimateTradeAmounts: () => {
        throw new Error('range estimator failed');
      },
      higherStrike1e9: validHigherStrike,
      lowerStrike1e9: validLowerStrike,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
    });

    expect(result).toMatchObject({
      error: {
        code: 'SIMULATION_FAILED',
        context: {
          errorName: 'Error',
        },
      },
      ok: false,
    });
  });
});
