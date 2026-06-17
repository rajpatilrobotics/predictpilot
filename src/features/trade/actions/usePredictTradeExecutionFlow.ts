import { useCallback, useMemo, useState } from 'react';
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
  prepareReview: (input: TInput) => Promise<PreparePredictTradeReviewResult<TPreview>>;
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
  prepareReview,
  queryClient,
  simulationTransport,
}: UsePredictTradeExecutionFlowOptions<TInput, TPreview>) {
  const dAppKit = useDAppKit();
  const currentClient = useCurrentClient();
  const defaultQueryClient = useQueryClient();
  const invalidationClient = queryClient ?? defaultQueryClient;
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
    setState(createInitialPredictTradeFlowState<TPreview>());
  }, []);

  const beginReview = useCallback(
    async (input: TInput) => {
      setState({
        ...createInitialPredictTradeFlowState<TPreview>(),
        phase: 'building',
      });

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
    },
    [defaultSimulationTransport, prepareReview],
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

    const refreshWarning = await invalidateAfterTrade({
      action,
      keys: state.builderPreview?.postTransactionRefreshKeys ?? [],
      queryClient: invalidationClient,
      service: `${copy.statusLabel}.invalidateAfterTrade`,
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

async function invalidateAfterTrade({
  action,
  keys,
  queryClient,
  service,
}: {
  action: PredictTransactionAction;
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
