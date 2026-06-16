import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import {
  buildBinaryMarketKey,
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
import type {
  BinaryDirection,
  MarketKeyModel,
  QuoteAmount,
  TimestampMs,
} from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';

export type BinaryTradePreviewAction = 'MINT' | 'REDEEM';
export type BinaryTradeEstimateSource = string;

export type BinaryTradePreviewWarningCode =
  | 'ASK_BOUNDS_PRESENT_UNMAPPED'
  | 'ASK_BOUNDS_UNAVAILABLE'
  | 'ESTIMATE_REQUIRES_AUTHORITATIVE_REFRESH'
  | 'ORACLE_REQUIRES_AUTHORITATIVE_REFRESH';

export interface BinaryTradePreviewWarning {
  code: BinaryTradePreviewWarningCode;
  message: string;
  severity: 'info' | 'warning';
}

export interface BinaryTradeAmountEstimatorInput {
  action: BinaryTradePreviewAction;
  manager: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  oracleState: OracleStateModel;
  quoteAsset: PredictQuoteAssetConfig;
  quantityQuote: QuoteAmount;
}

export type BinaryTradeAmountEstimate =
  | {
      action: 'MINT';
      estimatedCostQuote: QuoteAmount;
      isVerified: boolean;
      requiresAuthoritativeRefresh: boolean;
      source: BinaryTradeEstimateSource;
      warnings?: BinaryTradePreviewWarning[];
    }
  | {
      action: 'REDEEM';
      estimatedPayoutQuote: QuoteAmount;
      isVerified: boolean;
      requiresAuthoritativeRefresh: boolean;
      source: BinaryTradeEstimateSource;
      warnings?: BinaryTradePreviewWarning[];
    };

export type BinaryTradeAmountEstimator = (
  input: BinaryTradeAmountEstimatorInput,
) => BinaryTradeAmountEstimate | Promise<BinaryTradeAmountEstimate>;

export interface PreviewBinaryTradeOptions {
  action: BinaryTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  direction: BinaryDirection;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  manager?: ManagerSummaryModel | null;
  nowMs: TimestampMs | number;
  oracleState: OracleStateModel;
  ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
  strike1e9: StrikeInput;
}

export interface BinaryTradePreviewModel {
  action: BinaryTradePreviewAction;
  direction: BinaryDirection;
  estimateRequiresAuthoritativeRefresh: boolean;
  estimateSource: BinaryTradeEstimateSource;
  estimatedCostQuote?: QuoteAmount;
  estimatedPayoutQuote?: QuoteAmount;
  expiryMs: TimestampMs;
  managerBalanceQuote: QuoteAmount;
  managerId: ManagerSummaryModel['managerId'];
  marketKey: MarketKeyModel;
  oracleId: OracleStateModel['oracle']['oracleId'];
  oracleStatus: OracleStatusModel;
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  quoteAsset: PredictQuoteAssetConfig;
  requiresAuthoritativeRefresh: boolean;
  strike1e9: MarketKeyModel['strike1e9'];
  underlyingAsset: string;
  warnings: BinaryTradePreviewWarning[];
}

export type PreviewBinaryTradeResult =
  | {
      ok: true;
      preview: BinaryTradePreviewModel;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: BinaryTradePreviewWarning[];
    };

export async function previewBinaryTrade({
  action,
  askBounds,
  direction,
  estimateTradeAmounts,
  manager,
  nowMs,
  oracleState,
  ownedPosition,
  quantityQuote,
  strike1e9,
}: PreviewBinaryTradeOptions): Promise<PreviewBinaryTradeResult> {
  const warnings: BinaryTradePreviewWarning[] = [];

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
      message: 'Binary trade quantity must be greater than zero.',
      recovery: 'Enter a positive quantity before previewing this binary trade.',
    });
  }

  const marketKeyResult = buildBinaryMarketKey({
    askBounds: askBounds ?? oracleState.askBounds,
    direction,
    oracle: oracleState.oracle,
    strike1e9,
  });
  warnings.push(...marketKeyResult.warnings.map(mapMarketKeyWarning));

  if (!marketKeyResult.ok) {
    return failure('INVALID_INPUT', warnings, {
      context: {
        action,
        errors: marketKeyResult.errors.map((error) => error.code),
        field: 'strike1e9',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Binary strike input is invalid for this oracle.',
      recovery: 'Choose a strike that is above the minimum and aligned to the oracle tick size.',
    });
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });
  const availability = action === 'MINT' ? oracleStatus.mint : oracleStatus.redeem;

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

  if (action === 'REDEEM' && !hasEnoughOwnedQuantity(ownedPosition, marketKeyResult.key, quantityQuote)) {
    return failure('INVALID_INPUT', warnings, {
      context: {
        action,
        field: 'quantityQuote',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Redeem quantity exceeds the open binary position quantity.',
      recovery: 'Choose a quantity that is less than or equal to the open position quantity.',
    });
  }

  if (estimateTradeAmounts === undefined) {
    return failure('TODO_VERIFY_PATH_USED', warnings, {
      context: {
        action,
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
        previewPath: 'binary-trade-amount-estimator',
      },
    });
  }

  const estimate = await getVerifiedEstimate({
    action,
    estimateTradeAmounts,
    manager,
    marketKey: marketKeyResult.key,
    oracleState,
    quantityQuote,
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

  if (estimate.value.action === 'MINT' && estimate.value.estimatedCostQuote > manager.tradingBalanceQuote) {
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
      direction,
      estimateRequiresAuthoritativeRefresh: estimate.value.requiresAuthoritativeRefresh,
      estimateSource: estimate.value.source,
      ...(estimate.value.action === 'MINT'
        ? { estimatedCostQuote: estimate.value.estimatedCostQuote }
        : { estimatedPayoutQuote: estimate.value.estimatedPayoutQuote }),
      expiryMs: marketKeyResult.key.expiryMs,
      managerBalanceQuote: manager.tradingBalanceQuote,
      managerId: manager.managerId,
      marketKey: marketKeyResult.key,
      oracleId: oracleState.oracle.oracleId,
      oracleStatus,
      postTransactionRefreshKeys: predictInvalidationKeys.afterManagerWrite({
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      }),
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      requiresAuthoritativeRefresh:
        availability.requiresAuthoritativeRefresh || estimate.value.requiresAuthoritativeRefresh,
      strike1e9: marketKeyResult.key.strike1e9,
      underlyingAsset: oracleState.oracle.underlyingAsset,
      warnings,
    },
  };
}

async function getVerifiedEstimate({
  action,
  estimateTradeAmounts,
  manager,
  marketKey,
  oracleState,
  quantityQuote,
  warnings,
}: {
  action: BinaryTradePreviewAction;
  estimateTradeAmounts: BinaryTradeAmountEstimator;
  manager: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  oracleState: OracleStateModel;
  quantityQuote: QuoteAmount;
  warnings: BinaryTradePreviewWarning[];
}): Promise<
  | {
      ok: true;
      value: BinaryTradeAmountEstimate;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: BinaryTradePreviewWarning[];
    }
> {
  try {
    const estimate = await estimateTradeAmounts({
      action,
      manager,
      marketKey,
      oracleState,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
    });

    if (!estimate.isVerified) {
      return failure('TODO_VERIFY_PATH_USED', warnings, {
        context: {
          action,
          estimatorSource: estimate.source,
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
          previewPath: 'binary-trade-amount-estimator',
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
        message: 'Binary trade estimator returned an invalid result.',
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
  warnings: BinaryTradePreviewWarning[],
  options?: Parameters<typeof createAppError>[1],
): Extract<PreviewBinaryTradeResult, { ok: false }> {
  return {
    error: createAppError(code, options),
    ok: false,
    warnings,
  };
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

function hasEnoughOwnedQuantity(
  ownedPosition: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null | undefined,
  marketKey: MarketKeyModel,
  quantityQuote: QuoteAmount,
) {
  return (
    ownedPosition !== null &&
    ownedPosition !== undefined &&
    isSameMarketKey(ownedPosition.key, marketKey) &&
    ownedPosition.openQuantityQuote >= quantityQuote
  );
}

function isEstimateUsableForAction(
  action: BinaryTradePreviewAction,
  estimate: BinaryTradeAmountEstimate,
) {
  if (estimate.action !== action) {
    return false;
  }

  return estimate.action === 'MINT'
    ? estimate.estimatedCostQuote >= 0n
    : estimate.estimatedPayoutQuote >= 0n;
}

function isSameMarketKey(left: MarketKeyModel, right: MarketKeyModel) {
  return (
    left.direction === right.direction &&
    left.expiryMs === right.expiryMs &&
    left.oracleId === right.oracleId &&
    left.strike1e9 === right.strike1e9
  );
}

function mapMarketKeyWarning(warning: MarketKeyValidationWarning): BinaryTradePreviewWarning {
  return {
    code: warning.code,
    message: warning.message,
    severity: 'warning',
  };
}

function hasPositiveQuoteAmount(quantityQuote: QuoteAmount | null | undefined): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}
