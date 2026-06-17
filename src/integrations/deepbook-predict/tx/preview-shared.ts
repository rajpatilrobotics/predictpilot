import type { MarketKeyValidationWarning } from '@/features/markets/lib/market-keys';
import type { PredictPilotError } from '@/lib/errors';
import { createAppError } from '@/lib/errors';
import type { OracleActionAvailability } from '@/lib/oracle-status';
import type { MarketKeyModel, ObjectId, QuoteAmount, RangeKeyModel } from '@/types/predict';

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
  source: string;
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
