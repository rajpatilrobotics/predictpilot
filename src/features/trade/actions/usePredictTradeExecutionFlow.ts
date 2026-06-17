import { useCallback, useMemo, useRef, useState } from 'react';
import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { Transaction } from '@mysten/sui/transactions';
import type { RiskPreviewProps } from '@/features/tx/RiskPreview';
import {
  createLoadingPtbPreview,
  previewPredictTransactionSimulation,
  type PredictPtbSimulationPreview,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { runPostTransactionRefresh } from '@/lib/post-tx-refresh';
import {
  DEFAULT_PRE_SIGN_PREVIEW_TTL_MS,
  validateNoConcurrentExecution,
  validatePreSignSecurity,
} from '@/lib/security';
import { executePredictTransaction, type PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
  PredictTransactionExecutionResult,
} from '@/types/tx';

export type PredictTradeFlowPhase =
  | 'building'
  | 'failure'
  | 'idle'
  | 'ready'
  | 'signing'
  | 'simulating'
  | 'success';

type PredictTradeOperationLock = 'review' | 'signature' | null;

export interface PredictTradeTxPreviewBase {
  action: PredictTransactionAction;
  affectedObjects: AffectedObjectHint[];
  amountQuote?: QuoteAmount;
  postTransactionRefreshKeys: QueryKey[];
  plpAmountAtomic?: bigint;
  quantityQuote?: QuoteAmount;
  sender: SuiAddress;
}

export type PredictTradeRiskPreview = NonNullable<RiskPreviewProps['preview']>;

export interface PredictTradeFlowState<TPreview extends PredictTradeTxPreviewBase> {
  builderPreview: TPreview | null;
  completedDigest: TransactionDigest | null;
  error: PredictPilotError | null;
  executionRequest: PredictTransactionExecutionRequest | null;
  executionResult: PredictTransactionExecutionResult | null;
  modalOpen: boolean;
  phase: PredictTradeFlowPhase;
  previewPreparedAtMs: number | null;
  refreshWarning: PredictPilotError | null;
  riskPreview: PredictTradeRiskPreview | null;
  simulationPreview: PredictPtbSimulationPreview | null;
  warnings: TradeExecutionWarning[];
}

export interface TradeExecutionWarning {
  message: string;
  severity?: 'info' | 'warning';
}

export type PreparePredictTradeReviewResult<TPreview extends PredictTradeTxPreviewBase> =
  | {
      builderPreview: TPreview;
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      riskPreview: PredictTradeRiskPreview;
      warnings: TradeExecutionWarning[];
    }
  | {
      error: PredictPilotError;
      ok: false;
      riskPreview?: PredictTradeRiskPreview;
      warnings: TradeExecutionWarning[];
    };

export interface PredictTradeExecutionCopy {
  signatureNotReadyMessage: string;
  statusLabel: string;
}

export interface UsePredictTradeExecutionFlowOptions<
  TInput,
  TPreview extends PredictTradeTxPreviewBase,
> {
  action: PredictTransactionAction;
  copy: PredictTradeExecutionCopy;
  executionTransport?: PredictTransactionTransport;
  nowMs?: () => number;
  prepareReview: (input: TInput) => Promise<PreparePredictTradeReviewResult<TPreview>>;
  previewTtlMs?: number;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
}

export function createInitialPredictTradeFlowState<
  TPreview extends PredictTradeTxPreviewBase,
>(): PredictTradeFlowState<TPreview> {
  return {
    builderPreview: null,
    completedDigest: null,
    error: null,
    executionRequest: null,
    executionResult: null,
    modalOpen: false,
    phase: 'idle',
    previewPreparedAtMs: null,
    refreshWarning: null,
    riskPreview: null,
    simulationPreview: null,
    warnings: [],
  };
}

export function usePredictTradeExecutionFlow<TInput, TPreview extends PredictTradeTxPreviewBase>({
  action,
  copy,
  executionTransport,
  nowMs = Date.now,
  prepareReview,
  previewTtlMs = DEFAULT_PRE_SIGN_PREVIEW_TTL_MS,
  queryClient,
  simulationTransport,
}: UsePredictTradeExecutionFlowOptions<TInput, TPreview>) {
  const dAppKit = useDAppKit();
  const currentClient = useCurrentClient();
  const defaultQueryClient = useQueryClient();
  const invalidationClient = queryClient ?? defaultQueryClient;
  const operationLockRef = useRef<PredictTradeOperationLock>(null);
  const [state, setState] = useState<PredictTradeFlowState<TPreview>>(() =>
    createInitialPredictTradeFlowState<TPreview>(),
  );
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
    validatePreSignSecurity({
      action,
      nowMs: nowMs(),
      phase: state.phase,
      previewPreparedAtMs: state.previewPreparedAtMs,
      previewTtlMs,
      request: state.executionRequest,
      service: `${copy.statusLabel}.canRequestSignature`,
      simulationPreview: state.simulationPreview,
    }).ok;

  const closeModal = useCallback(() => {
    setState((current) => ({
      ...current,
      modalOpen: false,
    }));
  }, []);

  const reset = useCallback(() => {
    operationLockRef.current = null;
    setState(createInitialPredictTradeFlowState<TPreview>());
  }, []);

  const beginReview = useCallback(
    async (input: TInput) => {
      const lockValidation = validateOperationCanStart({
        action,
        lock: operationLockRef.current,
        phase: state.phase,
        service: `${copy.statusLabel}.beginReview`,
      });

      if (!lockValidation.ok) {
        setState({
          ...createInitialPredictTradeFlowState<TPreview>(),
          error: lockValidation.error,
          phase: 'failure',
        });

        return {
          error: lockValidation.error,
          ok: false as const,
          warnings: [],
        };
      }

      operationLockRef.current = 'review';

      setState({
        ...createInitialPredictTradeFlowState<TPreview>(),
        phase: 'building',
      });

      try {
        const prepared = await prepareReview(input);

        if (!prepared.ok) {
          setState({
            ...createInitialPredictTradeFlowState<TPreview>(),
            error: prepared.error,
            phase: 'failure',
            riskPreview: prepared.riskPreview ?? null,
            warnings: prepared.warnings,
          });

          return {
            error: prepared.error,
            ok: false as const,
            warnings: prepared.warnings,
          };
        }

        const preparedAtMs = nowMs();
        const loadingPreview = createLoadingPtbPreview({
          builderPreview: prepared.builderPreview,
          request: prepared.executionRequest,
        });

        setState({
          ...createInitialPredictTradeFlowState<TPreview>(),
          builderPreview: prepared.builderPreview,
          executionRequest: prepared.executionRequest,
          modalOpen: true,
          phase: 'simulating',
          previewPreparedAtMs: preparedAtMs,
          riskPreview: prepared.riskPreview,
          simulationPreview: loadingPreview,
          warnings: prepared.warnings,
        });

        const simulationPreview = await previewPredictTransactionSimulation({
          builderPreview: prepared.builderPreview,
          request: prepared.executionRequest,
          transport: defaultSimulationTransport,
        });

        setState((current) => ({
          ...current,
          error: 'error' in simulationPreview ? simulationPreview.error : null,
          phase: simulationPreview.status === 'ready' ? 'ready' : 'failure',
          simulationPreview,
        }));

        return {
          ok: true as const,
        };
      } finally {
        operationLockRef.current = null;
      }
    },
    [action, copy.statusLabel, defaultSimulationTransport, nowMs, prepareReview, state.phase],
  );

  const rerunSimulation = useCallback(async () => {
    if (state.executionRequest === null || state.builderPreview === null) {
      return;
    }

    const lockValidation = validateOperationCanStart({
      action,
      lock: operationLockRef.current,
      phase: state.phase,
      service: `${copy.statusLabel}.rerunSimulation`,
    });

    if (!lockValidation.ok) {
      setState((current) => ({
        ...current,
        error: lockValidation.error,
        phase: 'failure',
      }));
      return;
    }

    operationLockRef.current = 'review';

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

    try {
      const simulationPreview = await previewPredictTransactionSimulation({
        builderPreview: state.builderPreview,
        request: state.executionRequest,
        transport: defaultSimulationTransport,
      });

      setState((current) => ({
        ...current,
        error: 'error' in simulationPreview ? simulationPreview.error : null,
        phase: simulationPreview.status === 'ready' ? 'ready' : 'failure',
        previewPreparedAtMs: nowMs(),
        simulationPreview,
      }));
    } finally {
      operationLockRef.current = null;
    }
  }, [
    action,
    copy.statusLabel,
    defaultSimulationTransport,
    nowMs,
    state.builderPreview,
    state.executionRequest,
    state.phase,
  ]);

  const requestSignature = useCallback(async () => {
    const lockValidation = validateOperationCanStart({
      action,
      lock: operationLockRef.current,
      phase: state.phase,
      service: `${copy.statusLabel}.requestSignature`,
    });

    const signValidation = validatePreSignSecurity({
      action,
      nowMs: nowMs(),
      phase: state.phase,
      previewPreparedAtMs: state.previewPreparedAtMs,
      previewTtlMs,
      request: state.executionRequest,
      service: `${copy.statusLabel}.requestSignature`,
      simulationPreview: state.simulationPreview,
    });

    if (!lockValidation.ok) {
      setState((current) => ({
        ...current,
        error: lockValidation.error,
        phase: 'failure',
      }));
      return;
    }

    if (!signValidation.ok) {
      const error =
        signValidation.error.message === 'The transaction is not ready for wallet signature.'
          ? createAppError('INVALID_INPUT', {
              context: {
                action,
                service: `${copy.statusLabel}.requestSignature`,
              },
              message: copy.signatureNotReadyMessage,
              recovery: 'Run simulation and review the pre-sign modal before signing.',
            })
          : signValidation.error;

      setState((current) => ({
        ...current,
        error,
        phase: 'failure',
      }));
      return;
    }

    const executionRequest = state.executionRequest;
    if (executionRequest === null) {
      return;
    }

    operationLockRef.current = 'signature';

    setState((current) => ({
      ...current,
      error: null,
      phase: 'signing',
    }));

    try {
      const executionResult = await executePredictTransaction(
        executionRequest,
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

      const refreshWarning = await runPostTransactionRefresh({
        action,
        affectedObjects: executionResult.affectedObjects,
        digest: executionResult.digest,
        queryClient: invalidationClient,
        queryKeys: state.builderPreview?.postTransactionRefreshKeys ?? [],
        service: `${copy.statusLabel}.postTransactionRefresh`,
      });

      setState((current) => ({
        ...current,
        completedDigest: executionResult.digest,
        executionResult,
        phase: 'success',
        refreshWarning: executionResult.postSubmitWarning ?? refreshWarning,
      }));
    } finally {
      operationLockRef.current = null;
    }
  }, [
    action,
    copy.signatureNotReadyMessage,
    copy.statusLabel,
    defaultExecutionTransport,
    invalidationClient,
    nowMs,
    previewTtlMs,
    state.builderPreview?.postTransactionRefreshKeys,
    state.executionRequest,
    state.phase,
    state.previewPreparedAtMs,
    state.simulationPreview,
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

function validateOperationCanStart({
  action,
  lock,
  phase,
  service,
}: {
  action: PredictTransactionAction;
  lock: PredictTradeOperationLock;
  phase: PredictTradeFlowPhase;
  service: string;
}) {
  if (lock === null) {
    return validateNoConcurrentExecution({
      action,
      phase,
      service,
    });
  }

  return {
    error: createAppError('INVALID_INPUT', {
      context: {
        action,
        operation: lock,
        service,
      },
      message: 'Another transaction review or wallet request is already in progress.',
      recovery: 'Wait for the current review or wallet request to finish before trying again.',
      title: 'Action already in progress',
    }),
    ok: false as const,
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
