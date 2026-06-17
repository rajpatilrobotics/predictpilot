import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import {
  buildRangeKey,
  type MarketKeyValidationError,
  type StrikeInput,
} from '@/features/markets/lib/market-keys';
import type { PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { QuoteAmount, RangeKeyModel, TimestampMs } from '@/types/predict';
import type { ManagerSummaryModel, RangePositionModel } from '@/types/portfolio';
import {
  absorbEstimateWarnings,
  createCommonTradePreviewFields,
  getInsufficientManagerBalanceFailure,
  getOracleAvailabilityErrorCode,
  hasPositiveQuoteAmount,
  isSameRangeKey,
  mapMarketKeyWarning,
  previewFailure,
  pushOracleRefreshWarning,
  verifyTradeEstimate,
  type TradePreviewWarning,
  type TradePreviewWarningCode,
} from './preview-shared';

export type RangeTradePreviewAction = 'MINT_RANGE' | 'REDEEM_RANGE';
export type RangeTradeEstimateSource = string;

export type RangeTradePreviewWarningCode = TradePreviewWarningCode;
export type RangeTradePreviewWarning = TradePreviewWarning;

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
    return previewFailure('MANAGER_NOT_FOUND', warnings, {
      context: {
        action,
        oracleId: oracleState.oracle.oracleId,
      },
    });
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return previewFailure('INVALID_INPUT', warnings, {
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
    return previewFailure(getRangeKeyErrorCode(rangeKeyResult.errors), warnings, {
      context: {
        action,
        errors: rangeKeyResult.errors.map((error) => error.code),
        field: 'rangeKey',
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
      },
      message: 'Range strike inputs are invalid for this oracle.',
      recovery:
        'Choose lower and higher strikes that are ordered, above the minimum, and aligned to tick size.',
    });
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });
  const availability = action === 'MINT_RANGE' ? oracleStatus.mintRange : oracleStatus.redeemRange;

  if (!availability.isAllowed) {
    return previewFailure(getOracleAvailabilityErrorCode(availability), warnings, {
      context: {
        action,
        managerId: manager.managerId,
        oracleId: oracleState.oracle.oracleId,
        reasonCodes: availability.reasonCodes,
      },
    });
  }

  if (availability.requiresAuthoritativeRefresh) {
    pushOracleRefreshWarning(warnings);
  }

  if (
    action === 'REDEEM_RANGE' &&
    !hasEnoughOwnedRangeQuantity(ownedRangePosition, rangeKeyResult.key, quantityQuote)
  ) {
    return previewFailure('INVALID_INPUT', warnings, {
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

  const estimate = await verifyTradeEstimate({
    action,
    estimator: estimateTradeAmounts,
    input: {
      action,
      manager,
      oracleState,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: rangeKeyResult.key,
    },
    invalidEstimateMessage: 'Range trade estimator returned an invalid result.',
    isEstimateUsable: isEstimateUsableForAction,
    managerId: manager.managerId,
    oracleId: oracleState.oracle.oracleId,
    previewPath: 'range-trade-amount-estimator',
    warnings,
  });

  if (!estimate.ok) {
    return estimate;
  }

  absorbEstimateWarnings(estimate.value, warnings);

  const balanceFailure = getInsufficientManagerBalanceFailure({
    action,
    estimatedCostQuote:
      estimate.value.action === 'MINT_RANGE' ? estimate.value.estimatedCostQuote : undefined,
    managerBalanceQuote: manager.tradingBalanceQuote,
    managerId: manager.managerId,
    warnings,
  });

  if (balanceFailure !== null) {
    return balanceFailure;
  }

  return {
    ok: true,
    preview: {
      action,
      ...(estimate.value.action === 'MINT_RANGE'
        ? { estimatedCostQuote: estimate.value.estimatedCostQuote }
        : { estimatedPayoutQuote: estimate.value.estimatedPayoutQuote }),
      expiryMs: rangeKeyResult.key.expiryMs,
      higherStrike1e9: rangeKeyResult.key.higherStrike1e9,
      lowerStrike1e9: rangeKeyResult.key.lowerStrike1e9,
      oracleStatus,
      ...createCommonTradePreviewFields({
        availabilityRequiresAuthoritativeRefresh: availability.requiresAuthoritativeRefresh,
        estimate: estimate.value,
        manager,
        oracleState,
        quantityQuote,
        warnings,
      }),
      rangeKey: rangeKeyResult.key,
    },
  };
}

function getRangeKeyErrorCode(
  errors: MarketKeyValidationError[],
): 'INVALID_INPUT' | 'INVALID_RANGE' {
  return errors.some((error) => error.code === 'RANGE_ORDER_INVALID')
    ? 'INVALID_RANGE'
    : 'INVALID_INPUT';
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
