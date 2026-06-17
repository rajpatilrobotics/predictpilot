import type { MarketKeyValidationWarning } from '@/features/markets/lib/market-keys';
import { predictDeploymentConfig } from '@/config/predict';
import type { PredictPilotError } from '@/lib/errors';
import { createAppError } from '@/lib/errors';
import type { OracleActionAvailability } from '@/lib/oracle-status';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type { OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, ObjectId, QuoteAmount, RangeKeyModel } from '@/types/predict';
import type { ManagerSummaryModel } from '@/types/portfolio';

export type TradePreviewWarningCode =
  | 'ASK_BOUNDS_PRESENT_UNMAPPED'
  | 'ASK_BOUNDS_UNAVAILABLE'
  | 'ESTIMATE_REQUIRES_AUTHORITATIVE_REFRESH'
  | 'ORACLE_REQUIRES_AUTHORITATIVE_REFRESH';

export interface TradePreviewWarning {
  code: TradePreviewWarningCode;
  message: string;
  severity: 'info' | 'warning';
}

export function previewFailure<TWarning extends TradePreviewWarning>(
  code: Parameters<typeof createAppError>[0],
  warnings: TWarning[],
  options?: Parameters<typeof createAppError>[1],
) {
  return {
    error: createAppError(code, options),
    ok: false,
    warnings,
  } as const;
}

export function getOracleAvailabilityErrorCode(
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

export function mapMarketKeyWarning(warning: MarketKeyValidationWarning): TradePreviewWarning {
  return {
    code: warning.code,
    message: warning.message,
    severity: 'warning',
  };
}

export function hasPositiveQuoteAmount(
  quantityQuote: QuoteAmount | null | undefined,
): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}

export function isSameMarketKey(left: MarketKeyModel, right: MarketKeyModel) {
  return (
    left.direction === right.direction &&
    left.expiryMs === right.expiryMs &&
    left.oracleId === right.oracleId &&
    left.strike1e9 === right.strike1e9
  );
}

export function isSameRangeKey(left: RangeKeyModel, right: RangeKeyModel) {
  return (
    left.expiryMs === right.expiryMs &&
    left.higherStrike1e9 === right.higherStrike1e9 &&
    left.lowerStrike1e9 === right.lowerStrike1e9 &&
    left.oracleId === right.oracleId
  );
}

export function pushOracleRefreshWarning(warnings: TradePreviewWarning[]) {
  warnings.push({
    code: 'ORACLE_REQUIRES_AUTHORITATIVE_REFRESH',
    message: 'Oracle state is usable for preview, but should be refreshed before signing.',
    severity: 'warning',
  });
}

export function pushEstimateRefreshWarning(warnings: TradePreviewWarning[]) {
  warnings.push({
    code: 'ESTIMATE_REQUIRES_AUTHORITATIVE_REFRESH',
    message: 'The estimate requires an authoritative refresh before wallet signing.',
    severity: 'warning',
  });
}

export interface VerifiableTradeEstimate<TAction extends string> {
  action: TAction;
  isVerified: boolean;
  requiresAuthoritativeRefresh: boolean;
  source: string;
  warnings?: TradePreviewWarning[];
}

export interface CommonTradePreviewFields {
  estimateRequiresAuthoritativeRefresh: boolean;
  estimateSource: string;
  managerBalanceQuote: QuoteAmount;
  managerId: ObjectId;
  oracleId: ObjectId;
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  quoteAsset: typeof predictDeploymentConfig.quoteAsset;
  requiresAuthoritativeRefresh: boolean;
  underlyingAsset: string;
  warnings: TradePreviewWarning[];
}

export async function verifyTradeEstimate<
  TAction extends string,
  TEstimate extends VerifiableTradeEstimate<TAction>,
  TInput,
  TWarning extends TradePreviewWarning,
>({
  action,
  estimator,
  input,
  invalidEstimateMessage,
  isEstimateUsable,
  managerId,
  oracleId,
  previewPath,
  warnings,
}: {
  action: TAction;
  estimator?: ((input: TInput) => Promise<TEstimate> | TEstimate) | undefined;
  input: TInput;
  invalidEstimateMessage: string;
  isEstimateUsable: (action: TAction, estimate: TEstimate) => boolean;
  managerId: ObjectId;
  oracleId: ObjectId;
  previewPath: string;
  warnings: TWarning[];
}): Promise<
  | {
      ok: true;
      value: TEstimate;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: TWarning[];
    }
> {
  if (estimator === undefined) {
    return previewFailure('TODO_VERIFY_PATH_USED', warnings, {
      context: {
        action,
        managerId,
        oracleId,
        previewPath,
      },
    });
  }

  try {
    const estimate = await estimator(input);

    if (!estimate.isVerified) {
      return previewFailure('TODO_VERIFY_PATH_USED', warnings, {
        context: {
          action,
          estimatorSource: estimate.source,
          managerId,
          oracleId,
          previewPath,
        },
      });
    }

    if (!isEstimateUsable(action, estimate)) {
      return previewFailure('SIMULATION_FAILED', warnings, {
        context: {
          action,
          estimatorSource: estimate.source,
          managerId,
          oracleId,
        },
        message: invalidEstimateMessage,
        recovery: 'Refresh the preview inputs and retry with a verified estimator.',
      });
    }

    return {
      ok: true,
      value: estimate,
    };
  } catch (error) {
    return previewFailure('SIMULATION_FAILED', warnings, {
      context: {
        action,
        errorName: error instanceof Error ? error.name : typeof error,
        managerId,
        oracleId,
      },
    });
  }
}

export function absorbEstimateWarnings(
  estimate: VerifiableTradeEstimate<string>,
  warnings: TradePreviewWarning[],
) {
  warnings.push(...(estimate.warnings ?? []));

  if (estimate.requiresAuthoritativeRefresh) {
    pushEstimateRefreshWarning(warnings);
  }
}

export function getInsufficientManagerBalanceFailure<TAction extends string>({
  action,
  estimatedCostQuote,
  managerBalanceQuote,
  managerId,
  warnings,
}: {
  action: TAction;
  estimatedCostQuote?: QuoteAmount;
  managerBalanceQuote: QuoteAmount;
  managerId: ObjectId;
  warnings: TradePreviewWarning[];
}) {
  if (estimatedCostQuote === undefined || estimatedCostQuote <= managerBalanceQuote) {
    return null;
  }

  return previewFailure('INSUFFICIENT_MANAGER_DUSDC', warnings, {
    context: {
      action,
      estimatedCostQuote,
      managerBalanceQuote,
      managerId,
    },
  });
}

export function createCommonTradePreviewFields({
  availabilityRequiresAuthoritativeRefresh,
  estimate,
  manager,
  oracleState,
  quantityQuote,
  warnings,
}: {
  availabilityRequiresAuthoritativeRefresh: boolean;
  estimate: VerifiableTradeEstimate<string>;
  manager: ManagerSummaryModel;
  oracleState: OracleStateModel;
  quantityQuote: QuoteAmount;
  warnings: TradePreviewWarning[];
}): CommonTradePreviewFields {
  return {
    estimateRequiresAuthoritativeRefresh: estimate.requiresAuthoritativeRefresh,
    estimateSource: estimate.source,
    managerBalanceQuote: manager.tradingBalanceQuote,
    managerId: manager.managerId,
    oracleId: oracleState.oracle.oracleId,
    postTransactionRefreshKeys: predictInvalidationKeys.afterManagerWrite({
      managerId: manager.managerId,
      oracleId: oracleState.oracle.oracleId,
    }),
    quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    requiresAuthoritativeRefresh:
      availabilityRequiresAuthoritativeRefresh || estimate.requiresAuthoritativeRefresh,
    underlyingAsset: oracleState.oracle.underlyingAsset,
    warnings,
  };
}
