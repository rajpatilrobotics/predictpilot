import { useCallback, useState } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import type { QueryClient } from '@tanstack/react-query';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  previewRangeTrade,
  type RangeTradeAmountEstimator,
  type RangeTradePreviewAction,
  type RangeTradePreviewModel,
  type RangeTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-range';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import { predictDeploymentConfig } from '@/config/predict';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { ObjectId, QuoteAmount, RangeKeyModel, SuiAddress } from '@/types/predict';
import type { ManagerSummaryModel, RangePositionModel } from '@/types/portfolio';
import type { AffectedObjectHint, PredictTransactionExecutionRequest } from '@/types/tx';
import {
  createInitialPredictTradeFlowState,
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PredictTradeTxPreviewBase,
  type PreparePredictTradeReviewResult,
} from './usePredictTradeExecutionFlow';

export type RangeTradeFlowPhase = PredictTradeFlowPhase;

export interface RangeTradeTxPreviewBase extends PredictTradeTxPreviewBase {
  action: RangeTradePreviewAction;
  affectedObjects: AffectedObjectHint[];
  managerId: ObjectId;
  oracleId: ObjectId;
  rangeKey: RangeKeyModel;
}

export interface RangeTradeBuildOptions {
  managerId?: ObjectId | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
  sender?: SuiAddress | null;
}

export type RangeTradeBuildResult<TPreview extends RangeTradeTxPreviewBase> =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: TPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

export interface UseRangeTradeExecutionFlowOptions<TPreview extends RangeTradeTxPreviewBase> {
  action: RangeTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  buildTransaction: (options: RangeTradeBuildOptions) => RangeTradeBuildResult<TPreview>;
  copy: RangeTradeFlowCopy;
  estimateTradeAmounts?: RangeTradeAmountEstimator;
  executionTransport?: PredictTransactionTransport;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
}

export interface RangeTradeFlowCopy {
  invalidKeyMessage: string;
  invalidKeyRecovery: string;
  invalidQuantityMessage: string;
  invalidQuantityRecovery: string;
  invalidRangeMessage: string;
  invalidRangeRecovery: string;
  missingManagerSummaryMessage: string;
  missingManagerSummaryRecovery: string;
  missingOwnedPositionMessage?: string;
  missingOwnedPositionRecovery?: string;
  quantityExceedsOwnedMessage?: string;
  quantityExceedsOwnedRecovery?: string;
  reviewTitle: string;
  signatureNotReadyMessage: string;
  simulationRequiredMessage: string;
  statusLabel: string;
}

export interface BeginRangeTradeReviewInput {
  ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
}

export type BeginRangeTradeReviewResult =
  | {
      ok: true;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: RangeTradePreviewWarning[];
    };

export type RangeTradeFlowState<TPreview extends RangeTradeTxPreviewBase> =
  PredictTradeFlowState<TPreview>;

export function createInitialRangeTradeFlowState<
  TPreview extends RangeTradeTxPreviewBase,
>(): RangeTradeFlowState<TPreview> {
  return createInitialPredictTradeFlowState<TPreview>();
}

export function useRangeTradeExecutionFlow<TPreview extends RangeTradeTxPreviewBase>({
  action,
  askBounds,
  buildTransaction,
  copy,
  estimateTradeAmounts,
  executionTransport,
  manager,
  managerSummary,
  nowMs,
  oracleState,
  queryClient,
  simulationTransport,
  walletStatus,
}: UseRangeTradeExecutionFlowOptions<TPreview>) {
  const [initialNowMs] = useState(() => nowMs ?? Date.now());
  const effectiveNowMs = nowMs ?? initialNowMs;
  const prepareReview = useCallback(
    async ({
      ownedRangePosition,
      quantityQuote,
      rangeKey,
    }: BeginRangeTradeReviewInput): Promise<PreparePredictTradeReviewResult<TPreview>> => {
      const preconditions = validateRangeTradePreconditions({
        action,
        copy,
        manager,
        managerSummary,
        nowMs: effectiveNowMs,
        oracleState,
        ownedRangePosition,
        quantityQuote,
        rangeKey,
        walletStatus,
      });

      if (!preconditions.ok) {
        return {
          error: preconditions.error,
          ok: false,
          warnings: [],
        };
      }

      const riskResult = await createRangeTradeRiskPreview({
        action,
        askBounds,
        copy,
        estimateTradeAmounts,
        managerSummary: preconditions.managerSummary,
        nowMs: effectiveNowMs,
        oracleState,
        oracleStatus: preconditions.oracleStatus,
        ownedRangePosition: preconditions.ownedRangePosition,
        quantityQuote: preconditions.quantityQuote,
        rangeKey: preconditions.rangeKey,
      });

      if (!riskResult.ok) {
        return {
          error: riskResult.error,
          ok: false,
          riskPreview: createBlockedRiskPreview({
            action,
            copy,
            error: riskResult.error,
            managerSummary: preconditions.managerSummary,
            oracleState,
            oracleStatus: preconditions.oracleStatus,
            quantityQuote: preconditions.quantityQuote,
            rangeKey: preconditions.rangeKey,
            warnings: riskResult.warnings,
          }),
          warnings: riskResult.warnings,
        };
      }

      const builderResult = buildTransaction({
        managerId: preconditions.managerId,
        quantityQuote: preconditions.quantityQuote,
        rangeKey: preconditions.rangeKey,
        sender: preconditions.sender,
      });

      if (!builderResult.ok) {
        return {
          error: builderResult.error,
          ok: false,
          riskPreview: riskResult.preview,
          warnings: riskResult.warnings,
        };
      }

      return {
        builderPreview: builderResult.preview,
        executionRequest: builderResult.executionRequest,
        ok: true,
        riskPreview: riskResult.preview,
        warnings: riskResult.warnings,
      };
    },
    [
      action,
      askBounds,
      buildTransaction,
      copy,
      effectiveNowMs,
      estimateTradeAmounts,
      manager,
      managerSummary,
      oracleState,
      walletStatus,
    ],
  );

  return usePredictTradeExecutionFlow({
    action,
    copy,
    executionTransport,
    prepareReview,
    queryClient,
    simulationTransport,
  });
}

function validateRangeTradePreconditions({
  action,
  copy,
  manager,
  managerSummary,
  nowMs,
  oracleState,
  ownedRangePosition,
  quantityQuote,
  rangeKey,
  walletStatus,
}: {
  action: RangeTradePreviewAction;
  copy: RangeTradeFlowCopy;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs: number;
  oracleState: OracleStateModel;
  ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: NonNullable<UsePredictManagerResult['managerId']>;
      managerSummary: ManagerSummaryModel;
      ok: true;
      oracleStatus: OracleStatusModel;
      ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
      quantityQuote: QuoteAmount;
      rangeKey: RangeKeyModel;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    } {
  if (!walletStatus.isConnected || walletStatus.accountAddress === null) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action,
        },
      }),
      ok: false,
    };
  }

  if (!walletStatus.isExpectedNetwork || walletStatus.isWrongNetwork) {
    return {
      error: createAppError('WRONG_NETWORK', {
        context: {
          action,
          currentNetwork: walletStatus.currentNetwork,
          expectedNetwork: walletStatus.expectedNetwork,
        },
      }),
      ok: false,
    };
  }

  if (!manager.isReady || manager.managerId === null) {
    return {
      error: createAppError('MANAGER_NOT_FOUND', {
        context: {
          action,
          wallet: walletStatus.accountAddress,
        },
      }),
      ok: false,
    };
  }

  if (managerSummary === null || managerSummary === undefined) {
    return {
      error: createAppError('MANAGER_NOT_FOUND', {
        context: {
          action,
          managerId: manager.managerId,
        },
        message: copy.missingManagerSummaryMessage,
        recovery: copy.missingManagerSummaryRecovery,
      }),
      ok: false,
    };
  }

  if (
    rangeKey === null ||
    rangeKey === undefined ||
    rangeKey.oracleId !== oracleState.oracle.oracleId
  ) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'rangeKey',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: copy.invalidKeyMessage,
        recovery: copy.invalidKeyRecovery,
      }),
      ok: false,
    };
  }

  if (rangeKey.lowerStrike1e9 >= rangeKey.higherStrike1e9) {
    return {
      error: createAppError('INVALID_RANGE', {
        context: {
          action,
          field: 'rangeKey',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: copy.invalidRangeMessage,
        recovery: copy.invalidRangeRecovery,
      }),
      ok: false,
    };
  }

  if (typeof quantityQuote !== 'bigint' || quantityQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'quantityQuote',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: copy.invalidQuantityMessage,
        recovery: copy.invalidQuantityRecovery,
      }),
      ok: false,
    };
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });
  const availability = action === 'MINT_RANGE' ? oracleStatus.mintRange : oracleStatus.redeemRange;

  if (!availability.isAllowed) {
    const stale = availability.reasonCodes.some((code) =>
      ['ORACLE_PRICE_MISSING', 'ORACLE_STALE', 'ORACLE_SVI_MISSING'].includes(code),
    );

    return {
      error: createAppError(stale ? 'ORACLE_STALE' : 'ORACLE_NOT_TRADEABLE', {
        context: {
          action,
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
          reasonCodes: availability.reasonCodes,
        },
      }),
      ok: false,
    };
  }

  if (action === 'REDEEM_RANGE') {
    if (ownedRangePosition === null || ownedRangePosition === undefined) {
      return {
        error: createAppError('INVALID_INPUT', {
          context: {
            action,
            field: 'ownedRangePosition',
            managerId: manager.managerId,
            oracleId: oracleState.oracle.oracleId,
          },
          message: copy.missingOwnedPositionMessage ?? 'An open range position is required.',
          recovery:
            copy.missingOwnedPositionRecovery ??
            'Choose a range market with an open position before redeeming.',
        }),
        ok: false,
      };
    }

    if (
      !isSameRangeKey(ownedRangePosition.key, rangeKey) ||
      ownedRangePosition.quantityQuote < quantityQuote
    ) {
      return {
        error: createAppError('INVALID_INPUT', {
          context: {
            action,
            field: 'quantityQuote',
            managerId: manager.managerId,
            oracleId: oracleState.oracle.oracleId,
          },
          message:
            copy.quantityExceedsOwnedMessage ??
            'Redeem quantity exceeds the open range position quantity.',
          recovery:
            copy.quantityExceedsOwnedRecovery ??
            'Choose a quantity that is less than or equal to the open range position quantity.',
        }),
        ok: false,
      };
    }
  }

  return {
    managerId: manager.managerId,
    managerSummary,
    ok: true,
    oracleStatus,
    ownedRangePosition,
    quantityQuote,
    rangeKey,
    sender: walletStatus.accountAddress as SuiAddress,
  };
}

async function createRangeTradeRiskPreview({
  action,
  askBounds,
  copy,
  estimateTradeAmounts,
  managerSummary,
  nowMs,
  oracleState,
  oracleStatus,
  ownedRangePosition,
  quantityQuote,
  rangeKey,
}: {
  action: RangeTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  copy: RangeTradeFlowCopy;
  estimateTradeAmounts?: RangeTradeAmountEstimator;
  managerSummary: ManagerSummaryModel;
  nowMs: number;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
  quantityQuote: QuoteAmount;
  rangeKey: RangeKeyModel;
}): Promise<
  | {
      ok: true;
      preview: RangeTradePreviewModel | RiskPreviewModel;
      warnings: RangeTradePreviewWarning[];
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: RangeTradePreviewWarning[];
    }
> {
  const previewResult = await previewRangeTrade({
    action,
    askBounds,
    estimateTradeAmounts,
    higherStrike1e9: rangeKey.higherStrike1e9,
    lowerStrike1e9: rangeKey.lowerStrike1e9,
    manager: managerSummary,
    nowMs,
    oracleState,
    ownedRangePosition,
    quantityQuote,
  });

  if (previewResult.ok) {
    return {
      ok: true,
      preview: previewResult.preview,
      warnings: previewResult.preview.warnings,
    };
  }

  if (previewResult.error.code !== 'TODO_VERIFY_PATH_USED') {
    return previewResult;
  }

  return {
    ok: true,
    preview: createSimulationRequiredRiskPreview({
      action,
      copy,
      managerSummary,
      oracleState,
      oracleStatus,
      quantityQuote,
      rangeKey,
      warnings: previewResult.warnings,
    }),
    warnings: previewResult.warnings,
  };
}

function createSimulationRequiredRiskPreview({
  action,
  copy,
  managerSummary,
  oracleState,
  oracleStatus,
  quantityQuote,
  rangeKey,
  warnings,
}: {
  action: RangeTradePreviewAction;
  copy: RangeTradeFlowCopy;
  managerSummary: ManagerSummaryModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  rangeKey: RangeKeyModel;
  warnings: RangeTradePreviewWarning[];
}): RiskPreviewModel {
  return {
    action,
    askBoundsStatus: oracleState.askBounds.status,
    expiryMs: rangeKey.expiryMs,
    managerBalanceQuote: managerSummary.tradingBalanceQuote,
    managerId: managerSummary.managerId,
    oracleFreshness: oracleStatus.freshness.aggregateStatus,
    oracleId: oracleState.oracle.oracleId,
    oracleStatus: oracleStatus.lifecycleStatus,
    quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title: copy.reviewTitle,
    underlyingAsset: oracleState.oracle.underlyingAsset,
    warnings: [
      ...warnings,
      {
        message: copy.simulationRequiredMessage,
        severity: 'warning',
      },
    ],
  };
}

function createBlockedRiskPreview({
  action,
  copy,
  error,
  managerSummary,
  oracleState,
  oracleStatus,
  quantityQuote,
  rangeKey,
  warnings,
}: {
  action: RangeTradePreviewAction;
  copy: RangeTradeFlowCopy;
  error: PredictPilotError;
  managerSummary: ManagerSummaryModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  rangeKey: RangeKeyModel;
  warnings: RangeTradePreviewWarning[];
}): RiskPreviewModel {
  return {
    ...createSimulationRequiredRiskPreview({
      action,
      copy,
      managerSummary,
      oracleState,
      oracleStatus,
      quantityQuote,
      rangeKey,
      warnings,
    }),
    blockers: [error.message],
  };
}

function isSameRangeKey(left: RangeKeyModel, right: RangeKeyModel) {
  return (
    left.oracleId === right.oracleId &&
    left.expiryMs === right.expiryMs &&
    left.lowerStrike1e9 === right.lowerStrike1e9 &&
    left.higherStrike1e9 === right.higherStrike1e9
  );
}
