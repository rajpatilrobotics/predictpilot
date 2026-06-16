import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getBinaryPreviewActionCopy,
  getBinaryPreviewAmountCopy,
  getBinaryPreviewPrimaryAmount,
  getBinaryPreviewWarningCount,
} from '@/features/trade/lib/binary-preview';
import {
  previewBinaryTrade,
  type BinaryTradeAmountEstimator,
  type BinaryTradeAmountEstimatorInput,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';

const predictId = predictDeploymentConfig.predictObjectId;
const managerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId =
  '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const oracleCapId =
  '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817' as ObjectId;
const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const nowMs = 100_000n;

const validQuantity = 100_000n as QuoteAmount;
const validStrike = 65_000_000_000_000n;

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

function createOwnedPosition(
  overrides: Partial<BinaryPositionSummaryModel> = {},
): BinaryPositionSummaryModel {
  return {
    averageEntryQuote: 10_000n,
    firstMintedAtMs: 1n,
    key: {
      direction: 'UP',
      expiryMs: 200_000n,
      oracleId,
      strike1e9: validStrike,
    },
    lastActivityAtMs: 2n,
    managerId,
    mintedQuantityQuote: 200_000n,
    openCostBasisQuote: 20_000n,
    openQuantityQuote: 200_000n,
    predictId,
    quantityQuote: 200_000n,
    quoteAssetType: predictDeploymentConfig.quoteAsset.type,
    realizedPnlQuote: 0n,
    redeemedQuantityQuote: 0n,
    status: 'OPEN',
    totalCostQuote: 20_000n,
    totalPayoutQuote: 0n,
    underlyingAsset: 'BTC',
    unrealizedPnlQuote: 0n,
    ...overrides,
  };
}

function mintEstimator(costQuote: QuoteAmount = 250_000n): BinaryTradeAmountEstimator {
  return vi.fn((input: BinaryTradeAmountEstimatorInput) => ({
    action: 'MINT' as const,
    estimatedCostQuote: costQuote,
    isVerified: true,
    requiresAuthoritativeRefresh: false,
    source: `mock-${input.action.toLowerCase()}`,
  }));
}

function redeemEstimator(payoutQuote: QuoteAmount = 125_000n): BinaryTradeAmountEstimator {
  return vi.fn((input: BinaryTradeAmountEstimatorInput) => ({
    action: 'REDEEM' as const,
    estimatedPayoutQuote: payoutQuote,
    isVerified: true,
    requiresAuthoritativeRefresh: false,
    source: `mock-${input.action.toLowerCase()}`,
  }));
}

describe('previewBinaryTrade', () => {
  it('builds a successful binary mint preview with fresh oracle state and manager balance', async () => {
    const estimator = mintEstimator();
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(estimator).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MINT',
        marketKey: {
          direction: 'UP',
          expiryMs: 200_000n,
          oracleId,
          strike1e9: validStrike,
        },
        quantityQuote: validQuantity,
      }),
    );
    expect(result.preview).toMatchObject({
      action: 'MINT',
      direction: 'UP',
      estimatedCostQuote: 250_000n,
      estimateSource: 'mock-mint',
      managerBalanceQuote: 2_000_000n,
      managerId,
      oracleId,
      quantityQuote: validQuantity,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      requiresAuthoritativeRefresh: false,
      strike1e9: validStrike,
      underlyingAsset: 'BTC',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(getBinaryPreviewActionCopy(result.preview)).toBe('Mint binary position');
    expect(getBinaryPreviewPrimaryAmount(result.preview)).toEqual({
      amountQuote: 250_000n,
      label: 'Estimated cost',
    });
    expect(getBinaryPreviewAmountCopy(result.preview)).toBe('Estimated cost: 250000 DUSDC');
  });

  it('builds a successful binary redeem preview with owned quantity', async () => {
    const result = await previewBinaryTrade({
      action: 'REDEEM',
      direction: 'UP',
      estimateTradeAmounts: redeemEstimator(),
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      ownedPosition: createOwnedPosition(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'REDEEM',
      estimatedPayoutQuote: 125_000n,
      estimateSource: 'mock-redeem',
      requiresAuthoritativeRefresh: false,
    });
    expect(getBinaryPreviewPrimaryAmount(result.preview)).toEqual({
      amountQuote: 125_000n,
      label: 'Estimated payout',
    });
    expect(getBinaryPreviewWarningCount(result.preview.warnings)).toBe(1);
  });

  it('blocks zero or negative quantity before estimation', async () => {
    const estimator = mintEstimator();
    const zero = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: 0n,
      strike1e9: validStrike,
    });
    const negative = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: -1n,
      strike1e9: validStrike,
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

  it('blocks invalid strikes through the market-key helper', async () => {
    const estimator = mintEstimator();
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: 49_000_000_000_000n,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          errors: ['STRIKE_BELOW_MINIMUM'],
          field: 'strike1e9',
        },
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks missing manager before estimation', async () => {
    const estimator = mintEstimator();
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: null,
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
    const estimator = mintEstimator();
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({
        latestPriceAtMs: 80_000n,
      }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });

    expect(result).toMatchObject({
      error: {
        code: 'ORACLE_STALE',
      },
      ok: false,
    });
    expect(estimator).not.toHaveBeenCalled();
  });

  it('blocks inactive and settled mint previews before estimation', async () => {
    const estimator = mintEstimator();
    const inactive = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ lifecycleStatus: 'INACTIVE' }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });
    const settled = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ lifecycleStatus: 'SETTLED', settlementPrice1e9: validStrike }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: mintEstimator(3_000_000n),
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INSUFFICIENT_MANAGER_DUSDC',
      },
      ok: false,
    });
  });

  it('blocks redeem when requested quantity exceeds owned open quantity', async () => {
    const estimator = redeemEstimator();
    const result = await previewBinaryTrade({
      action: 'REDEEM',
      direction: 'UP',
      estimateTradeAmounts: estimator,
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      ownedPosition: createOwnedPosition({ openQuantityQuote: 50_000n }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
    const unavailable = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: mintEstimator(),
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ askBounds: { status: 'UNAVAILABLE' } }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });
    const unmapped = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: mintEstimator(),
      manager: createManager(),
      nowMs,
      oracleState: createOracleState({ askBounds: { status: 'PRESENT_UNMAPPED' } }),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
    const missing = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
    });
    const unverified = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: () => ({
        action: 'MINT',
        estimatedCostQuote: 250_000n,
        isVerified: false,
        requiresAuthoritativeRefresh: false,
        source: 'unverified-local-estimate',
      }),
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
    const result = await previewBinaryTrade({
      action: 'MINT',
      direction: 'UP',
      estimateTradeAmounts: () => {
        throw new Error('estimator failed');
      },
      manager: createManager(),
      nowMs,
      oracleState: createOracleState(),
      quantityQuote: validQuantity,
      strike1e9: validStrike,
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
