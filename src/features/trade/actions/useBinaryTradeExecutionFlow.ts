import { useCallback } from 'react';
import type { Transaction } from '@mysten/sui/transactions';
import type { QueryClient } from '@tanstack/react-query';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  previewBinaryTrade,
  type BinaryTradeAmountEstimator,
  type BinaryTradePreviewAction,
  type BinaryTradePreviewModel,
  type BinaryTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';
import type { AffectedObjectHint, PredictTransactionExecutionRequest } from '@/types/tx';
import {
  createInitialPredictTradeFlowState,
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PredictTradeTxPreviewBase,
  type PreparePredictTradeReviewResult,
} from './usePredictTradeExecutionFlow';
import {
  createBlockedRiskPreview,
  createSimulationRequiredRiskPreview,
  isOracleAvailabilityStale,
  useStableInitialNowMs,
  validateTradeWalletManagerBase,
} from './trade-flow-shared';
import { recoverBinaryTradeDigest } from './trade-action-recovery';

export type BinaryTradeFlowPhase = PredictTradeFlowPhase;

export interface BinaryTradeTxPreviewBase extends PredictTradeTxPreviewBase {
  action: BinaryTradePreviewAction;
  affectedObjects: AffectedObjectHint[];
  managerId: ObjectId;
  marketKey: MarketKeyModel;
  oracleId: MarketKeyModel['oracleId'];
}

export interface BinaryTradeBuildOptions {
  managerId?: MarketKeyModel['oracleId'] | null;
  marketKey?: MarketKeyModel | null;
  quantityQuote?: QuoteAmount | null;
  sender?: SuiAddress | null;
}

export type BinaryTradeBuildResult<TPreview extends BinaryTradeTxPreviewBase> =
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

export interface UseBinaryTradeExecutionFlowOptions<TPreview extends BinaryTradeTxPreviewBase> {
  action: BinaryTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  buildTransaction: (options: BinaryTradeBuildOptions) => BinaryTradeBuildResult<TPreview>;
  copy: BinaryTradeFlowCopy;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  executionTransport?: PredictTransactionTransport;
  historyClient?: HistoryReadClient;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  tradeRecoveryMaxAttempts?: number;
  tradeRecoveryPollDelayMs?: number;
  walletStatus: WalletStatusModel;
  walletReturnTimeoutMs?: number;
}

export interface BinaryTradeFlowCopy {
  invalidKeyMessage: string;
  invalidKeyRecovery: string;
  invalidQuantityMessage: string;
  invalidQuantityRecovery: string;
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

export interface BeginBinaryTradeReviewInput {
  marketKey?: MarketKeyModel | null;
  ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
}

export type BeginBinaryTradeReviewResult =
  | {
      ok: true;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: BinaryTradePreviewWarning[];
    };

export type BinaryTradeFlowState<TPreview extends BinaryTradeTxPreviewBase> =
  PredictTradeFlowState<TPreview>;

export function createInitialBinaryTradeFlowState<
  TPreview extends BinaryTradeTxPreviewBase,
>(): BinaryTradeFlowState<TPreview> {
  return createInitialPredictTradeFlowState<TPreview>();
}

export function useBinaryTradeExecutionFlow<TPreview extends BinaryTradeTxPreviewBase>({
  action,
  askBounds,
  buildTransaction,
  copy,
  estimateTradeAmounts,
  executionTransport,
  historyClient,
  manager,
  managerSummary,
  nowMs,
  oracleState,
  queryClient,
  simulationTransport,
  tradeRecoveryMaxAttempts,
  tradeRecoveryPollDelayMs,
  walletStatus,
  walletReturnTimeoutMs,
}: UseBinaryTradeExecutionFlowOptions<TPreview>) {
  const initialNowMs = useStableInitialNowMs(nowMs);
  const effectiveNowMs = nowMs ?? initialNowMs;
  const prepareReview = useCallback(
    async ({
      marketKey,
      ownedPosition,
      quantityQuote,
    }: BeginBinaryTradeReviewInput): Promise<PreparePredictTradeReviewResult<TPreview>> => {
      const preconditions = validateBinaryTradePreconditions({
        action,
        copy,
        manager,
        managerSummary,
        marketKey,
        nowMs: effectiveNowMs,
        oracleState,
        ownedPosition,
        quantityQuote,
        walletStatus,
      });

      if (!preconditions.ok) {
        return {
          error: preconditions.error,
          ok: false,
          warnings: [],
        };
      }

      const riskResult = await createBinaryTradeRiskPreview({
        action,
        askBounds,
        copy,
        estimateTradeAmounts,
        managerSummary: preconditions.managerSummary,
        marketKey: preconditions.marketKey,
        nowMs: effectiveNowMs,
        oracleState,
        oracleStatus: preconditions.oracleStatus,
        ownedPosition: preconditions.ownedPosition,
        quantityQuote: preconditions.quantityQuote,
      });

      if (!riskResult.ok) {
        return {
          error: riskResult.error,
          ok: false,
          riskPreview: createBlockedRiskPreview({
            action,
            copy,
            error: riskResult.error,
            expiryMs: preconditions.marketKey.expiryMs,
            managerSummary: preconditions.managerSummary,
            oracleState,
            oracleStatus: preconditions.oracleStatus,
            payoff: {
              direction: preconditions.marketKey.direction,
              kind: 'binary',
              strike1e9: preconditions.marketKey.strike1e9,
            },
            quantityQuote: preconditions.quantityQuote,
            warnings: riskResult.warnings,
          }),
          warnings: riskResult.warnings,
        };
      }

      const builderResult = buildTransaction({
        managerId: preconditions.managerId,
        marketKey: preconditions.marketKey,
        quantityQuote: preconditions.quantityQuote,
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
    recoverSubmittedTransaction: async ({ builderPreview, requestedAtMs }) =>
      recoverBinaryTradeDigest({
        client: historyClient,
        maxAttempts: tradeRecoveryMaxAttempts,
        pollDelayMs: tradeRecoveryPollDelayMs,
        preview: builderPreview,
        requestedAtMs,
      }),
    simulationTransport,
    walletReturnTimeoutMs,
  });
}

function validateBinaryTradePreconditions({
  action,
  copy,
  manager,
  managerSummary,
  marketKey,
  nowMs,
  oracleState,
  ownedPosition,
  quantityQuote,
  walletStatus,
}: {
  action: BinaryTradePreviewAction;
  copy: BinaryTradeFlowCopy;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  marketKey?: MarketKeyModel | null;
  nowMs: number;
  oracleState: OracleStateModel;
  ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: NonNullable<UsePredictManagerResult['managerId']>;
      managerSummary: ManagerSummaryModel;
      marketKey: MarketKeyModel;
      ok: true;
      oracleStatus: OracleStatusModel;
      ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
      quantityQuote: QuoteAmount;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    } {
  const baseValidation = validateTradeWalletManagerBase({
    action,
    copy,
    manager,
    managerSummary,
    walletStatus,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (
    marketKey === null ||
    marketKey === undefined ||
    marketKey.oracleId !== oracleState.oracle.oracleId
  ) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'marketKey',
          managerId: baseValidation.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: copy.invalidKeyMessage,
        recovery: copy.invalidKeyRecovery,
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
          managerId: baseValidation.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: copy.invalidQuantityMessage,
        recovery: copy.invalidQuantityRecovery,
      }),
      ok: false,
    };
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });
  const availability = action === 'MINT' ? oracleStatus.mint : oracleStatus.redeem;

  if (!availability.isAllowed) {
    return {
      error: createAppError(
        isOracleAvailabilityStale(availability.reasonCodes)
          ? 'ORACLE_STALE'
          : 'ORACLE_NOT_TRADEABLE',
        {
          context: {
            action,
            managerId: baseValidation.managerId,
            oracleId: oracleState.oracle.oracleId,
            reasonCodes: availability.reasonCodes,
          },
        },
      ),
      ok: false,
    };
  }

  if (action === 'REDEEM') {
    if (ownedPosition === null || ownedPosition === undefined) {
      return {
        error: createAppError('INVALID_INPUT', {
          context: {
            action,
            field: 'ownedPosition',
            managerId: baseValidation.managerId,
            oracleId: oracleState.oracle.oracleId,
          },
          message: copy.missingOwnedPositionMessage ?? 'An open binary position is required.',
          recovery:
            copy.missingOwnedPositionRecovery ??
            'Choose a binary market with an open position before redeeming.',
        }),
        ok: false,
      };
    }

    if (
      !isSameMarketKey(ownedPosition.key, marketKey) ||
      ownedPosition.openQuantityQuote < quantityQuote
    ) {
      return {
        error: createAppError('INVALID_INPUT', {
          context: {
            action,
            field: 'quantityQuote',
            managerId: baseValidation.managerId,
            oracleId: oracleState.oracle.oracleId,
          },
          message:
            copy.quantityExceedsOwnedMessage ??
            'Redeem quantity exceeds the open binary position quantity.',
          recovery:
            copy.quantityExceedsOwnedRecovery ??
            'Choose a quantity that is less than or equal to the open position quantity.',
        }),
        ok: false,
      };
    }
  }

  return {
    managerId: baseValidation.managerId,
    managerSummary: baseValidation.managerSummary,
    marketKey,
    ok: true,
    oracleStatus,
    ownedPosition,
    quantityQuote,
    sender: baseValidation.sender,
  };
}

async function createBinaryTradeRiskPreview({
  action,
  askBounds,
  copy,
  estimateTradeAmounts,
  managerSummary,
  marketKey,
  nowMs,
  oracleState,
  oracleStatus,
  ownedPosition,
  quantityQuote,
}: {
  action: BinaryTradePreviewAction;
  askBounds?: OracleAskBoundsModel;
  copy: BinaryTradeFlowCopy;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  managerSummary: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  nowMs: number;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
  quantityQuote: QuoteAmount;
}): Promise<
  | {
      ok: true;
      preview: BinaryTradePreviewModel | RiskPreviewModel;
      warnings: BinaryTradePreviewWarning[];
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: BinaryTradePreviewWarning[];
    }
> {
  const previewResult = await previewBinaryTrade({
    action,
    askBounds,
    direction: marketKey.direction,
    estimateTradeAmounts,
    manager: managerSummary,
    nowMs,
    oracleState,
    ownedPosition,
    quantityQuote,
    strike1e9: marketKey.strike1e9,
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
      expiryMs: marketKey.expiryMs,
      managerSummary,
      oracleState,
      oracleStatus,
      payoff: {
        direction: marketKey.direction,
        kind: 'binary',
        strike1e9: marketKey.strike1e9,
      },
      quantityQuote,
      warnings: previewResult.warnings,
    }),
    warnings: previewResult.warnings,
  };
}

function isSameMarketKey(left: MarketKeyModel, right: MarketKeyModel) {
  return (
    left.oracleId === right.oracleId &&
    left.expiryMs === right.expiryMs &&
    left.strike1e9 === right.strike1e9 &&
    left.direction === right.direction
  );
}
