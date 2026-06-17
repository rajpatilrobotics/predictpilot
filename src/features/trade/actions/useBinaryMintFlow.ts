import { useCallback, useMemo, useState } from 'react';
import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { Transaction } from '@mysten/sui/transactions';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  buildMintBinaryTx,
  type MintBinaryTxPreview,
} from '@/integrations/deepbook-predict/tx/mint-binary';
import {
  createLoadingPtbPreview,
  previewPredictTransactionSimulation,
  type PredictPtbSimulationPreview,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import {
  previewBinaryTrade,
  type BinaryTradeAmountEstimator,
  type BinaryTradePreviewModel,
  type BinaryTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import { predictDeploymentConfig } from '@/config/predict';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { getOracleStatus, type OracleStatusModel } from '@/lib/oracle-status';
import { executePredictTransaction, type PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import type { ManagerSummaryModel } from '@/types/portfolio';
import type {
  PredictTransactionExecutionRequest,
  PredictTransactionExecutionResult,
} from '@/types/tx';

export type BinaryMintFlowPhase =
  | 'building'
  | 'failure'
  | 'idle'
  | 'ready'
  | 'signing'
  | 'simulating'
  | 'success';

export interface UseBinaryMintFlowOptions {
  askBounds?: OracleAskBoundsModel;
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

export interface BeginBinaryMintReviewInput {
  marketKey?: MarketKeyModel | null;
  quantityQuote?: QuoteAmount | null;
}

export type BeginBinaryMintReviewResult =
  | {
      ok: true;
    }
  | {
      error: PredictPilotError;
      ok: false;
      warnings: BinaryTradePreviewWarning[];
    };

export interface BinaryMintFlowState {
  builderPreview: MintBinaryTxPreview | null;
  completedDigest: TransactionDigest | null;
  error: PredictPilotError | null;
  executionRequest: PredictTransactionExecutionRequest | null;
  executionResult: PredictTransactionExecutionResult | null;
  modalOpen: boolean;
  phase: BinaryMintFlowPhase;
  refreshWarning: PredictPilotError | null;
  riskPreview: BinaryTradePreviewModel | RiskPreviewModel | null;
  simulationPreview: PredictPtbSimulationPreview | null;
  warnings: BinaryTradePreviewWarning[];
}

const initialState: BinaryMintFlowState = {
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

export function useBinaryMintFlow({
  askBounds,
  estimateTradeAmounts,
  executionTransport,
  manager,
  managerSummary,
  nowMs,
  oracleState,
  queryClient,
  simulationTransport,
  walletStatus,
}: UseBinaryMintFlowOptions) {
  const dAppKit = useDAppKit();
  const currentClient = useCurrentClient();
  const defaultQueryClient = useQueryClient();
  const invalidationClient = queryClient ?? defaultQueryClient;
  const [state, setState] = useState<BinaryMintFlowState>(initialState);
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
    setState(initialState);
  }, []);

  const beginMintReview = useCallback(
    async ({
      marketKey,
      quantityQuote,
    }: BeginBinaryMintReviewInput): Promise<BeginBinaryMintReviewResult> => {
      setState({
        ...initialState,
        phase: 'building',
      });

      const preconditions = validateBinaryMintPreconditions({
        manager,
        managerSummary,
        marketKey,
        nowMs: effectiveNowMs,
        oracleState,
        quantityQuote,
        walletStatus,
      });

      if (!preconditions.ok) {
        setState({
          ...initialState,
          error: preconditions.error,
          phase: 'failure',
        });

        return {
          error: preconditions.error,
          ok: false,
          warnings: [],
        };
      }

      const riskResult = await createBinaryMintRiskPreview({
        askBounds,
        estimateTradeAmounts,
        managerSummary: preconditions.managerSummary,
        nowMs: effectiveNowMs,
        oracleState,
        quantityQuote: preconditions.quantityQuote,
        marketKey: preconditions.marketKey,
        oracleStatus: preconditions.oracleStatus,
      });

      if (!riskResult.ok) {
        setState({
          ...initialState,
          error: riskResult.error,
          phase: 'failure',
          riskPreview: createBlockedRiskPreview({
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

      const builderResult = buildMintBinaryTx({
        managerId: preconditions.managerId,
        marketKey: preconditions.marketKey,
        quantityQuote: preconditions.quantityQuote,
        sender: preconditions.sender,
      });

      if (!builderResult.ok) {
        setState({
          ...initialState,
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
        ...initialState,
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
      askBounds,
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
          action: 'MINT',
          service: 'useBinaryMintFlow.requestSignature',
        },
        message: 'Binary mint simulation must be ready before requesting a wallet signature.',
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

    const refreshWarning = await invalidateAfterBinaryMint({
      keys: state.builderPreview?.postTransactionRefreshKeys ?? [],
      queryClient: invalidationClient,
    });

    setState((current) => ({
      ...current,
      completedDigest: executionResult.digest,
      executionResult,
      phase: 'success',
      refreshWarning: executionResult.postSubmitWarning ?? refreshWarning,
    }));
  }, [
    canRequestSignature,
    defaultExecutionTransport,
    invalidationClient,
    state.builderPreview?.postTransactionRefreshKeys,
    state.executionRequest,
  ]);

  return {
    beginMintReview,
    canRequestSignature,
    closeModal,
    requestSignature,
    rerunSimulation,
    reset,
    state,
  };
}

function validateBinaryMintPreconditions({
  manager,
  managerSummary,
  marketKey,
  nowMs,
  oracleState,
  quantityQuote,
  walletStatus,
}: {
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  marketKey?: MarketKeyModel | null;
  nowMs: number;
  oracleState: OracleStateModel;
  quantityQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: NonNullable<UsePredictManagerResult['managerId']>;
      managerSummary: ManagerSummaryModel;
      marketKey: MarketKeyModel;
      ok: true;
      oracleStatus: OracleStatusModel;
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
          action: 'MINT',
        },
      }),
      ok: false,
    };
  }

  if (!walletStatus.isExpectedNetwork || walletStatus.isWrongNetwork) {
    return {
      error: createAppError('WRONG_NETWORK', {
        context: {
          action: 'MINT',
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
          action: 'MINT',
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
          action: 'MINT',
          managerId: manager.managerId,
        },
        message: 'PredictManager summary is required before binary mint execution.',
        recovery: 'Refresh manager state before opening the mint execution review.',
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
          action: 'MINT',
          field: 'marketKey',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: 'A valid binary market key is required before mint execution.',
        recovery: 'Choose a valid direction and strike for the selected oracle.',
      }),
      ok: false,
    };
  }

  if (typeof quantityQuote !== 'bigint' || quantityQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: 'MINT',
          field: 'quantityQuote',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
        },
        message: 'Binary mint quantity must be greater than zero.',
        recovery: 'Enter a positive quantity before opening the execution review.',
      }),
      ok: false,
    };
  }

  const oracleStatus = getOracleStatus({ nowMs, oracleState });

  if (!oracleStatus.mint.isAllowed) {
    const stale = oracleStatus.mint.reasonCodes.some((code) =>
      ['ORACLE_PRICE_MISSING', 'ORACLE_STALE', 'ORACLE_SVI_MISSING'].includes(code),
    );

    return {
      error: createAppError(stale ? 'ORACLE_STALE' : 'ORACLE_NOT_TRADEABLE', {
        context: {
          action: 'MINT',
          managerId: manager.managerId,
          oracleId: oracleState.oracle.oracleId,
          reasonCodes: oracleStatus.mint.reasonCodes,
        },
      }),
      ok: false,
    };
  }

  return {
    managerId: manager.managerId,
    managerSummary,
    marketKey,
    ok: true,
    oracleStatus,
    quantityQuote,
    sender: walletStatus.accountAddress as SuiAddress,
  };
}

async function createBinaryMintRiskPreview({
  askBounds,
  estimateTradeAmounts,
  managerSummary,
  marketKey,
  nowMs,
  oracleState,
  oracleStatus,
  quantityQuote,
}: {
  askBounds?: OracleAskBoundsModel;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  managerSummary: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  nowMs: number;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
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
    action: 'MINT',
    askBounds,
    direction: marketKey.direction,
    estimateTradeAmounts,
    manager: managerSummary,
    nowMs,
    oracleState,
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
  managerSummary,
  marketKey,
  oracleState,
  oracleStatus,
  quantityQuote,
  warnings,
}: {
  managerSummary: ManagerSummaryModel;
  marketKey: MarketKeyModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  warnings: BinaryTradePreviewWarning[];
}): RiskPreviewModel {
  return {
    action: 'MINT',
    askBoundsStatus: oracleState.askBounds.status,
    expiryMs: marketKey.expiryMs,
    managerBalanceQuote: managerSummary.tradingBalanceQuote,
    managerId: managerSummary.managerId,
    oracleFreshness: oracleStatus.freshness.aggregateStatus,
    oracleId: oracleState.oracle.oracleId,
    oracleStatus: oracleStatus.lifecycleStatus,
    quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title: 'Binary mint execution review',
    underlyingAsset: oracleState.oracle.underlyingAsset,
    warnings: [
      ...warnings,
      {
        message:
          'Exact mint cost is not fabricated. Review the simulation before requesting a wallet signature.',
        severity: 'warning',
      },
    ],
  };
}

function createBlockedRiskPreview({
  error,
  managerSummary,
  marketKey,
  oracleState,
  oracleStatus,
  quantityQuote,
  warnings,
}: {
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

async function invalidateAfterBinaryMint({
  keys,
  queryClient,
}: {
  keys: QueryKey[];
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
}) {
  try {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return null;
  } catch (error) {
    return createAppError('POST_TX_REFRESH_FAILED', {
      context: {
        action: 'MINT',
        errorName: error instanceof Error ? error.name : typeof error,
        refreshKeys: keys.length,
        service: 'useBinaryMintFlow.invalidateAfterBinaryMint',
      },
    });
  }
}
