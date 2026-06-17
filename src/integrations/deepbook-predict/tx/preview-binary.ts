import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { buildBinaryMarketKey, type StrikeInput } from '@/features/markets/lib/market-keys';
import type { PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { BinaryDirection, MarketKeyModel, QuoteAmount, TimestampMs } from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';
import {
  absorbEstimateWarnings,
  createCommonTradePreviewFields,
  getInsufficientManagerBalanceFailure,
  getOracleAvailabilityErrorCode,
  hasPositiveQuoteAmount,
  isSameMarketKey,
  mapMarketKeyWarning,
  previewFailure,
  pushOracleRefreshWarning,
  verifyTradeEstimate,
  type TradePreviewWarning,
  type TradePreviewWarningCode,
} from './preview-shared';

export type BinaryTradePreviewAction = 'MINT' | 'REDEEM';
export type BinaryTradeEstimateSource = string;

export type BinaryTradePreviewWarningCode = TradePreviewWarningCode;
export type BinaryTradePreviewWarning = TradePreviewWarning;

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
    return previewFailure('INVALID_INPUT', warnings, {
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
    action === 'REDEEM' &&
    !hasEnoughOwnedQuantity(ownedPosition, marketKeyResult.key, quantityQuote)
  ) {
    return previewFailure('INVALID_INPUT', warnings, {
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

  const estimate = await verifyTradeEstimate({
    action,
    estimator: estimateTradeAmounts,
    input: {
      action,
      manager,
      marketKey: marketKeyResult.key,
      oracleState,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
    },
    invalidEstimateMessage: 'Binary trade estimator returned an invalid result.',
    isEstimateUsable: isEstimateUsableForAction,
    managerId: manager.managerId,
    oracleId: oracleState.oracle.oracleId,
    previewPath: 'binary-trade-amount-estimator',
    warnings,
  });

  if (!estimate.ok) {
    return estimate;
  }

  absorbEstimateWarnings(estimate.value, warnings);

  const balanceFailure = getInsufficientManagerBalanceFailure({
    action,
    estimatedCostQuote:
      estimate.value.action === 'MINT' ? estimate.value.estimatedCostQuote : undefined,
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
      direction,
      ...(estimate.value.action === 'MINT'
        ? { estimatedCostQuote: estimate.value.estimatedCostQuote }
        : { estimatedPayoutQuote: estimate.value.estimatedPayoutQuote }),
      expiryMs: marketKeyResult.key.expiryMs,
      marketKey: marketKeyResult.key,
      oracleStatus,
      ...createCommonTradePreviewFields({
        availabilityRequiresAuthoritativeRefresh: availability.requiresAuthoritativeRefresh,
        estimate: estimate.value,
        manager,
        oracleState,
        quantityQuote,
        warnings,
      }),
      strike1e9: marketKeyResult.key.strike1e9,
    },
  };
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
