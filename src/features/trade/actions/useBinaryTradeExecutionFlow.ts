import { useCallback, useMemo, useState } from 'react';
import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { Transaction } from '@mysten/sui/transactions';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  createLoadingPtbPreview,
  previewPredictTransactionSimulation,
  type PredictPtbSimulationPreview,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import {
  previewBinaryTrade,
  type BinaryTradeAmountEstimator,
  type BinaryTradePreviewAction,
  type BinaryTradePreviewModel,
  type BinaryTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import { predictDeploymentConfig } from '@/config/predict';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import { executePredictTransaction, type PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';
import type {
  AffectedObjectHint,
  PredictTransactionExecutionRequest,
  PredictTransactionExecutionResult,
} from '@/types/tx';

export type BinaryTradeFlowPhase =
  | 'building'
  | 'failure'
  | 'idle'
  | 'ready'
  | 'signing'
  | 'simulating'
  | 'success';

export interface BinaryTradeTxPreviewBase {
  action: BinaryTradePreviewAction;
  affectedObjects: AffectedObjectHint[];
  managerId: MarketKeyModel['oracleId'];
  marketKey: MarketKeyModel;
  oracleId: MarketKeyModel['oracleId'];
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  sender: SuiAddress;
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
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
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

export interface BinaryTradeFlowState<TPreview extends BinaryTradeTxPreviewBase> {
  builderPreview: TPreview | null;
  completedDigest: TransactionDigest | null;
  error: PredictPilotError | null;
  executionRequest: PredictTransactionExecutionRequest | null;
  executionResult: PredictTransactionExecutionResult | null;
  modalOpen: boolean;
  phase: BinaryTradeFlowPhase;
  refreshWarning: PredictPilotError | null;
  riskPreview: BinaryTradePreviewModel | RiskPreviewModel | null;
  simulationPreview: PredictPtbSimulationPreview | null;
  warnings: BinaryTradePreviewWarning[];
}

export function createInitialBinaryTradeFlowState<
  TPreview extends BinaryTradeTxPreviewBase,
>(): BinaryTradeFlowState<TPreview> {
  return {
    builderPreview: null,
    completedDigest: null,
    error: null,
    executionRequest: null,
    executionResult: null,
    modalOpen: false,
    phase: 'idle',
    refreshWarning: null,
    riskPreview: null,
    simulationPreview: null,
    warnings: [],
  };
}

export function useBinaryTradeExecutionFlow<TPreview extends BinaryTradeTxPreviewBase>({
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
}: UseBinaryTradeExecutionFlowOptions<TPreview>) {
  const dAppKit = useDAppKit();
  const currentClient = useCurrentClient();
  const defaultQueryClient = useQueryClient();
  const invalidationClient = queryClient ?? defaultQueryClient;
  const [state, setState] = useState<BinaryTradeFlowState<TPreview>>(() =>
    createInitialBinaryTradeFlowState<TPreview>(),
  );
  const [initialNowMs] = useState(() => Date.now());
  const effectiveNowMs = nowMs ?? initialNowMs;
  const defaultSimulationTransport =
    simulationTransport === undefined ? currentClient : simulationTransport;
  const defaultExecutionTransport = useMemo(
    () =>
      executionTransport ??
      createDAppKitTransactionTransport({
        dAppKit,
        suiClient: currentClient,
      }),
    [currentClient, dAppKit, executionTransport],
  );
  const canRequestSignature =
    state.phase === 'ready' &&
    state.executionRequest !== null &&
    state.simulationPreview?.status === 'ready';

  const closeModal = useCallback(() => {
    setState((current) => ({
      ...current,
      modalOpen: false,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialBinaryTradeFlowState<TPreview>());
  }, []);

  const beginReview = useCallback(
    async ({
      marketKey,
      ownedPosition,
      quantityQuote,
    }: BeginBinaryTradeReviewInput): Promise<BeginBinaryTradeReviewResult> => {
      setState({
        ...createInitialBinaryTradeFlowState<TPreview>(),
        phase: 'building',
      });

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
        setState({
          ...createInitialBinaryTradeFlowState<TPreview>(),
          error: preconditions.error,
          phase: 'failure',
        });

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
        setState({
          ...createInitialBinaryTradeFlowState<TPreview>(),
          error: riskResult.error,
          phase: 'failure',
          riskPreview: createBlockedRiskPreview({
            action,
            copy,
            error: riskResult.error,
            managerSummary: preconditions.managerSummary,
            marketKey: preconditions.marketKey,
            oracleState,
            oracleStatus: preconditions.oracleStatus,
            quantityQuote: preconditions.quantityQuote,
            warnings: riskResult.warnings,
          }),
          warnings: riskResult.warnings,
        });

        return riskResult;
      }

      const builderResult = buildTransaction({
        managerId: preconditions.managerId,
        marketKey: preconditions.marketKey,
        quantityQuote: preconditions.quantityQuote,
        sender: preconditions.sender,
      });

      if (!builderResult.ok) {
        setState({
          ...createInitialBinaryTradeFlowState<TPreview>(),
          error: builderResult.error,
          phase: 'failure',
          riskPreview: riskResult.preview,
          warnings: riskResult.warnings,
        });

        return {
          error: builderResult.error,
          ok: false,
          warnings: riskResult.warnings,
        };
      }

      const loadingPreview = createLoadingPtbPreview({
        builderPreview: builderResult.preview,
        request: builderResult.executionRequest,
      });

      setState({
        ...createInitialBinaryTradeFlowState<TPreview>(),
        builderPreview: builderResult.preview,
        executionRequest: builderResult.executionRequest,
        modalOpen: true,
        phase: 'simulating',
        riskPreview: riskResult.preview,
        simulationPreview: loadingPreview,
        warnings: riskResult.warnings,
      });

      const simulationPreview = await previewPredictTransactionSimulation({
        builderPreview: builderResult.preview,
        request: builderResult.executionRequest,
        transport: defaultSimulationTransport,
      });

      setState((current) => ({
        ...current,
        error: 'error' in simulationPreview ? simulationPreview.error : null,
        phase: simulationPreview.status === 'ready' ? 'ready' : 'failure',
        simulationPreview,
      }));

      return {
        ok: true,
      };
    },
    [
      action,
      askBounds,
      buildTransaction,
      copy,
      defaultSimulationTransport,
      effectiveNowMs,
      estimateTradeAmounts,
      manager,
      managerSummary,
      oracleState,
      walletStatus,
    ],
  );

  const rerunSimulation = useCallback(async () => {
    if (state.executionRequest === null || state.builderPreview === null) {
      return;
    }

    const loadingPreview = createLoadingPtbPreview({
      builderPreview: state.builderPreview,
      request: state.executionRequest,
    });

    setState((current) => ({
      ...current,
      error: null,
      phase: 'simulating',
      simulationPreview: loadingPreview,
    }));

    const simulationPreview = await previewPredictTransactionSimulation({
      builderPreview: state.builderPreview,
      request: state.executionRequest,
      transport: defaultSimulationTransport,
    });

    setState((current) => ({
      ...current,
      error: 'error' in simulationPreview ? simulationPreview.error : null,
      phase: simulationPreview.status === 'ready' ? 'ready' : 'failure',
      simulationPreview,
    }));
  }, [defaultSimulationTransport, state.builderPreview, state.executionRequest]);

  const requestSignature = useCallback(async () => {
    if (!canRequestSignature || state.executionRequest === null) {
      const error = createAppError('INVALID_INPUT', {
        context: {
          action,
          service: `${copy.statusLabel}.requestSignature`,
        },
        message: copy.signatureNotReadyMessage,
        recovery: 'Run simulation and review the pre-sign modal before signing.',
      });

      setState((current) => ({
        ...current,
        error,
        phase: 'failure',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      error: null,
      phase: 'signing',
    }));

    const executionResult = await executePredictTransaction(
      state.executionRequest,
      defaultExecutionTransport,
    );

    if (executionResult.status === 'failure') {
      setState((current) => ({
        ...current,
        completedDigest: executionResult.digest ?? null,
        error: executionResult.error,
        executionResult,
        phase: 'failure',
      }));
      return;
    }

    const refreshWarning = await invalidateAfterBinaryTrade({
      action,
      keys: state.builderPreview?.postTransactionRefreshKeys ?? [],
      queryClient: invalidationClient,
      service: `${copy.statusLabel}.invalidateAfterBinaryTrade`,
    });

    setState((current) => ({
      ...current,
      completedDigest: executionResult.digest,
      executionResult,
      phase: 'success',
      refreshWarning: executionResult.postSubmitWarning ?? refreshWarning,
    }));
  }, [
    action,
    canRequestSignature,
    copy.signatureNotReadyMessage,
    copy.statusLabel,
    defaultExecutionTransport,
    invalidationClient,
    state.builderPreview?.postTransactionRefreshKeys,
    state.executionRequest,
  ]);

  return {
    beginReview,
    canRequestSignature,
    closeModal,
    requestSignature,
    rerunSimulation,
    reset,
    state,
  };
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
    marketKey === null ||
    marketKey === undefined ||
    marketKey.oracleId !== oracleState.oracle.oracleId
  ) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'marketKey',
          managerId: manager.managerId,
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
  const availability = action === 'MINT' ? oracleStatus.mint : oracleStatus.redeem;

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

  if (action === 'REDEEM') {
    if (ownedPosition === null || ownedPosition === undefined) {
      return {
        error: createAppError('INVALID_INPUT', {
          context: {
            action,
            field: 'ownedPosition',
            managerId: manager.managerId,
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
            managerId: manager.managerId,
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
    managerId: manager.managerId,
    managerSummary,
    marketKey,
    ok: true,
    oracleStatus,
    ownedPosition,
    quantityQuote,
    sender: walletStatus.accountAddress as SuiAddress,
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
      managerSummary,
      marketKey,
      oracleState,
      oracleStatus,
      quantityQuote,
      warnings: previewResult.warnings,
    }),
    warnings: previewResult.warnings,
  };
}

function createSimulationRequiredRiskPreview({
  action,
  copy,
  managerSummary,
  marketKey,
  oracleState,
  oracleStatus,
  quantityQuote,
  warnings,
}: {
  action: BinaryTradePreviewAction;
  copy: BinaryTradeFlowCopy;
  managerSummary: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  warnings: BinaryTradePreviewWarning[];
}): RiskPreviewModel {
  return {
    action,
    askBoundsStatus: oracleState.askBounds.status,
    expiryMs: marketKey.expiryMs,
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
  marketKey,
  oracleState,
  oracleStatus,
  quantityQuote,
  warnings,
}: {
  action: BinaryTradePreviewAction;
  copy: BinaryTradeFlowCopy;
  error: PredictPilotError;
  managerSummary: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  warnings: BinaryTradePreviewWarning[];
}): RiskPreviewModel {
  return {
    ...createSimulationRequiredRiskPreview({
      action,
      copy,
      managerSummary,
      marketKey,
      oracleState,
      oracleStatus,
      quantityQuote,
      warnings,
    }),
    blockers: [error.message],
  };
}

function createDAppKitTransactionTransport({
  dAppKit,
  suiClient,
}: {
  dAppKit: {
    signAndExecuteTransaction: (input: { transaction: Transaction }) => Promise<unknown>;
  };
  suiClient: {
    waitForTransaction?: (input: {
      digest: TransactionDigest;
      include: Parameters<
        NonNullable<PredictTransactionTransport['waitForTransaction']>
      >[0]['include'];
    }) => Promise<unknown>;
  };
}): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: ({ transaction }) =>
      dAppKit.signAndExecuteTransaction({
        transaction,
      }),
    ...(typeof suiClient.waitForTransaction === 'function'
      ? {
          waitForTransaction: ({ digest, include }) =>
            suiClient.waitForTransaction?.({
              digest,
              include,
            }) ?? Promise.resolve({ digest }),
        }
      : {}),
  };
}

async function invalidateAfterBinaryTrade({
  action,
  keys,
  queryClient,
  service,
}: {
  action: BinaryTradePreviewAction;
  keys: QueryKey[];
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
  service: string;
}) {
  try {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return null;
  } catch (error) {
    return createAppError('POST_TX_REFRESH_FAILED', {
      context: {
        action,
        errorName: error instanceof Error ? error.name : typeof error,
        refreshKeys: keys.length,
        service,
      },
    });
  }
}

function isSameMarketKey(left: MarketKeyModel, right: MarketKeyModel) {
  return (
    left.oracleId === right.oracleId &&
    left.expiryMs === right.expiryMs &&
    left.strike1e9 === right.strike1e9 &&
    left.direction === right.direction
  );
}
