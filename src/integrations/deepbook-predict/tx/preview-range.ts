import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import {
  buildRangeKey,
  type MarketKeyValidationError,
  type MarketKeyValidationWarning,
  type StrikeInput,
} from '@/features/markets/lib/market-keys';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import {
  getOracleStatus,
  type OracleActionAvailability,
  type OracleStatusModel,
} from '@/lib/oracle-status';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { QuoteAmount, RangeKeyModel, TimestampMs } from '@/types/predict';
import type { ManagerSummaryModel, RangePositionModel } from '@/types/portfolio';

export type RangeTradePreviewAction = 'MINT_RANGE' | 'REDEEM_RANGE';
export type RangeTradeEstimateSource = string;

export type RangeTradePreviewWarningCode =
  | 'ASK_BOUNDS_PRESENT_UNMAPPED'
  | 'ASK_BOUNDS_UNAVAILABLE'
  | 'ESTIMATE_REQUIRES_AUTHORITATIVE_REFRESH'
  | 'ORACLE_REQUIRES_AUTHORITATIVE_REFRESH';

export interface RangeTradePreviewWarning {
  code: RangeTradePreviewWarningCode;
  message: string;
  severity: 'info' | 'warning';
}

export interface RangeTradeAmountEstimatorInput {
  action: RangeTradePreviewAction;
  manager: ManagerSummaryModel;
  oracleState: OracleStateModel;
  quantityQuote: QuoteAmount;
  quoteAsset: PredictQuoteAssetConfig;
  rangeKey: RangeKeyModel;
}

export type RangeTradeAmountEstimate =
  | {
      action: 'MINT_RANGE';
      estimatedCostQuote: QuoteAmount;
      isVerified: boolean;
      requiresAuthoritativeRefresh: boolean;
      source: RangeTradeEstimateSource;
      warnings?: RangeTradePreviewWarning[];
    }
  | {
      action: 'REDEEM_RANGE';
      estimatedPayoutQuote: QuoteAmount;
      isVerified: boolean;
      requiresAuthoritativeRefresh: boolean;
      source: RangeTradeEstimateSource;
      warnings?: RangeTradePreviewWarning[];
    };

export type RangeTradeAmountEstimator = (
  input: RangeTradeAmountEstimatorInput,
) => RangeTradeAmountEstimate | Promise<RangeTradeAmountEstimate>;

export interface PreviewRangeTradeOptions {
  action: RangeTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  estimateTradeAmounts?: RangeTradeAmountEstimator;
  higherStrike1e9: StrikeInput;
  lowerStrike1e9: StrikeInput;
  manager?: ManagerSummaryModel | null;
  nowMs: TimestampMs | number;
  oracleState: OracleStateModel;
  ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
}

export interface RangeTradePreviewModel {
  action: RangeTradePreviewAction;
  estimateRequiresAuthoritativeRefresh: boolean;
  estimateSource: RangeTradeEstimateSource;
  estimatedCostQuote?: QuoteAmount;
  estimatedPayoutQuote?: QuoteAmount;
  expiryMs: TimestampMs;
  higherStrike1e9: RangeKeyModel['higherStrike1e9'];
  lowerStrike1e9: RangeKeyModel['lowerStrike1e9'];
  managerBalanceQuote: QuoteAmount;
  managerId: ManagerSummaryModel['managerId'];
  oracleId: OracleStateModel['oracle']['oracleId'];
  oracleStatus: OracleStatusModel;
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  quoteAsset: PredictQuoteAssetConfig;
  rangeKey: RangeKeyModel;
  requiresAuthoritativeRefresh: boolean;
  underlyingAsset: string;
  warnings: RangeTradePreviewWarning[];
}

export type PreviewRangeTradeResult =
  | {
      ok: true;
      preview: RangeTradePreviewModel;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: RangeTradePreviewWarning[];
    };

export async function previewRangeTrade({
  action,
  askBounds,
  estimateTradeAmounts,
  higherStrike1e9,
  lowerStrike1e9,
  manager,
  nowMs,
  oracleState,
  ownedRangePosition,
  quantityQuote,
}: PreviewRangeTradeOptions): Promise<PreviewRangeTradeResult> {
  const warnings: RangeTradePreviewWarning[] = [];

  if (manager === null || manager === undefined) {
    return failure('MANAGER_NOT_FOUND', warnings, {
      context: {
        action,
        oracleId: oracleState.oracle.oracleId,
      },
    });
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return failure('INVALID_INPUT', warnings, {
      context: {
        action,
        field: 'quantityQuote',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Range trade quantity must be greater than zero.',
      recovery: 'Enter a positive quantity before previewing this range trade.',
    });
  }

  const rangeKeyResult = buildRangeKey({
    askBounds: askBounds ?? oracleState.askBounds,
    higherStrike1e9,
    lowerStrike1e9,
    oracle: oracleState.oracle,
  });
  warnings.push(...rangeKeyResult.warnings.map(mapMarketKeyWarning));

  if (!rangeKeyResult.ok) {
    return failure(getRangeKeyErrorCode(rangeKeyResult.errors), warnings, {
      context: {
        action,
        errors: rangeKeyResult.errors.map((error) => error.code),
        field: 'rangeKey',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Range strike inputs are invalid for this oracle.',
      recovery: 'Choose lower and higher strikes that are ordered, above the minimum, and aligned to tick size.',
    });
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });
  const availability = action === 'MINT_RANGE' ? oracleStatus.mintRange : oracleStatus.redeemRange;

  if (!availability.isAllowed) {
    return failure(getOracleAvailabilityErrorCode(availability), warnings, {
      context: {
        action,
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
        reasonCodes: availability.reasonCodes,
      },
    });
  }

  if (availability.requiresAuthoritativeRefresh) {
    warnings.push({
      code: 'ORACLE_REQUIRES_AUTHORITATIVE_REFRESH',
      message: 'Oracle state is usable for preview, but should be refreshed before signing.',
      severity: 'warning',
    });
  }

  if (action === 'REDEEM_RANGE' && !hasEnoughOwnedRangeQuantity(ownedRangePosition, rangeKeyResult.key, quantityQuote)) {
    return failure('INVALID_INPUT', warnings, {
      context: {
        action,
        field: 'quantityQuote',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Redeem quantity exceeds the open range position quantity.',
      recovery: 'Choose a quantity that is less than or equal to the open range position quantity.',
    });
  }

  if (estimateTradeAmounts === undefined) {
    return failure('TODO_VERIFY_PATH_USED', warnings, {
      context: {
        action,
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
        previewPath: 'range-trade-amount-estimator',
      },
    });
  }

  const estimate = await getVerifiedEstimate({
    action,
    estimateTradeAmounts,
    manager,
    oracleState,
    quantityQuote,
    rangeKey: rangeKeyResult.key,
    warnings,
  });

  if (!estimate.ok) {
    return estimate;
  }

  warnings.push(...(estimate.value.warnings ?? []));

  if (estimate.value.requiresAuthoritativeRefresh) {
    warnings.push({
      code: 'ESTIMATE_REQUIRES_AUTHORITATIVE_REFRESH',
      message: 'The estimate requires an authoritative refresh before wallet signing.',
      severity: 'warning',
    });
  }

  if (estimate.value.action === 'MINT_RANGE' && estimate.value.estimatedCostQuote > manager.tradingBalanceQuote) {
    return failure('INSUFFICIENT_MANAGER_DUSDC', warnings, {
      context: {
        action,
        estimatedCostQuote: estimate.value.estimatedCostQuote,
        managerBalanceQuote: manager.tradingBalanceQuote,
        managerId: manager.managerId,
      },
    });
  }

  return {
    ok: true,
    preview: {
      action,
      estimateRequiresAuthoritativeRefresh: estimate.value.requiresAuthoritativeRefresh,
      estimateSource: estimate.value.source,
      ...(estimate.value.action === 'MINT_RANGE'
        ? { estimatedCostQuote: estimate.value.estimatedCostQuote }
        : { estimatedPayoutQuote: estimate.value.estimatedPayoutQuote }),
      expiryMs: rangeKeyResult.key.expiryMs,
      higherStrike1e9: rangeKeyResult.key.higherStrike1e9,
      lowerStrike1e9: rangeKeyResult.key.lowerStrike1e9,
      managerBalanceQuote: manager.tradingBalanceQuote,
      managerId: manager.managerId,
      oracleId: oracleState.oracle.oracleId,
      oracleStatus,
      postTransactionRefreshKeys: predictInvalidationKeys.afterManagerWrite({
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      }),
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: rangeKeyResult.key,
      requiresAuthoritativeRefresh:
        availability.requiresAuthoritativeRefresh || estimate.value.requiresAuthoritativeRefresh,
      underlyingAsset: oracleState.oracle.underlyingAsset,
      warnings,
    },
  };
}

async function getVerifiedEstimate({
  action,
  estimateTradeAmounts,
  manager,
  oracleState,
  quantityQuote,
  rangeKey,
  warnings,
}: {
  action: RangeTradePreviewAction;
  estimateTradeAmounts: RangeTradeAmountEstimator;
  manager: ManagerSummaryModel;
  oracleState: OracleStateModel;
  quantityQuote: QuoteAmount;
  rangeKey: RangeKeyModel;
  warnings: RangeTradePreviewWarning[];
}): Promise<
  | {
      ok: true;
      value: RangeTradeAmountEstimate;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: RangeTradePreviewWarning[];
    }
> {
  try {
    const estimate = await estimateTradeAmounts({
      action,
      manager,
      oracleState,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey,
    });

    if (!estimate.isVerified) {
      return failure('TODO_VERIFY_PATH_USED', warnings, {
        context: {
          action,
          estimatorSource: estimate.source,
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
          previewPath: 'range-trade-amount-estimator',
        },
      });
    }

    if (!isEstimateUsableForAction(action, estimate)) {
      return failure('SIMULATION_FAILED', warnings, {
        context: {
          action,
          estimatorSource: estimate.source,
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: 'Range trade estimator returned an invalid result.',
        recovery: 'Refresh the preview inputs and retry with a verified estimator.',
      });
    }

    return {
      ok: true,
      value: estimate,
    };
  } catch (error) {
    return failure('SIMULATION_FAILED', warnings, {
      context: {
        action,
        errorName: error instanceof Error ? error.name : typeof error,
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
    });
  }
}

function failure(
  code: Parameters<typeof createAppError>[0],
  warnings: RangeTradePreviewWarning[],
  options?: Parameters<typeof createAppError>[1],
): Extract<PreviewRangeTradeResult, { ok: false }> {
  return {
    error: createAppError(code, options),
    ok: false,
    warnings,
  };
}

function getRangeKeyErrorCode(errors: MarketKeyValidationError[]): 'INVALID_INPUT' | 'INVALID_RANGE' {
  return errors.some((error) => error.code === 'RANGE_ORDER_INVALID') ? 'INVALID_RANGE' : 'INVALID_INPUT';
}

function getOracleAvailabilityErrorCode(
  availability: OracleActionAvailability,
): 'ORACLE_NOT_TRADEABLE' | 'ORACLE_STALE' {
  if (
    availability.reasonCodes.includes('ORACLE_STALE') ||
    availability.reasonCodes.includes('ORACLE_PRICE_MISSING') ||
    availability.reasonCodes.includes('ORACLE_SVI_MISSING')
  ) {
    return 'ORACLE_STALE';
  }

  return 'ORACLE_NOT_TRADEABLE';
}

function hasEnoughOwnedRangeQuantity(
  ownedRangePosition: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null | undefined,
  rangeKey: RangeKeyModel,
  quantityQuote: QuoteAmount,
) {
  return (
    ownedRangePosition !== null &&
    ownedRangePosition !== undefined &&
    isSameRangeKey(ownedRangePosition.key, rangeKey) &&
    ownedRangePosition.quantityQuote >= quantityQuote
  );
}

function isEstimateUsableForAction(
  action: RangeTradePreviewAction,
  estimate: RangeTradeAmountEstimate,
) {
  if (estimate.action !== action) {
    return false;
  }

  return estimate.action === 'MINT_RANGE'
    ? estimate.estimatedCostQuote >= 0n
    : estimate.estimatedPayoutQuote >= 0n;
}

function isSameRangeKey(left: RangeKeyModel, right: RangeKeyModel) {
  return (
    left.expiryMs === right.expiryMs &&
    left.higherStrike1e9 === right.higherStrike1e9 &&
    left.lowerStrike1e9 === right.lowerStrike1e9 &&
    left.oracleId === right.oracleId
  );
}

function mapMarketKeyWarning(warning: MarketKeyValidationWarning): RangeTradePreviewWarning {
  return {
    code: warning.code,
    message: warning.message,
    severity: 'warning',
  };
}

function hasPositiveQuoteAmount(quantityQuote: QuoteAmount | null | undefined): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}
