import type { QueryClient } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import {
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PreparePredictTradeReviewResult,
} from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  buildCreateManagerTx,
  type CreateManagerTxPreview,
} from '@/integrations/deepbook-predict/tx/create-manager';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { SuiAddress } from '@/types/predict';

export type CreateManagerFlowPhase = PredictTradeFlowPhase;
export type CreateManagerFlowPreview = CreateManagerTxPreview & {
  postTransactionRefreshKeys: ReturnType<typeof createManagerRefreshKeys>;
};
export type CreateManagerFlowState = PredictTradeFlowState<CreateManagerFlowPreview>;

export interface UseCreateManagerFlowOptions {
  executionTransport?: PredictTransactionTransport;
  hasExistingManager?: boolean;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
}

const createManagerFlowCopy = {
  signatureNotReadyMessage:
    'PredictManager creation simulation must be ready before requesting a wallet signature.',
  statusLabel: 'useCreateManagerFlow',
} as const;

const createManagerWarnings = [
  {
    message:
      'The new PredictManager ID is resolved from confirmed transaction effects and refresh.',
    severity: 'warning' as const,
  },
];

export function useCreateManagerFlow({
  executionTransport,
  hasExistingManager = false,
  queryClient,
  simulationTransport,
  walletStatus,
}: UseCreateManagerFlowOptions) {
  const prepareReview = async (): Promise<
    PreparePredictTradeReviewResult<CreateManagerFlowPreview>
  > => {
    await Promise.resolve();

    const validation = validateCreateManagerPreconditions({ hasExistingManager, walletStatus });

    if (!validation.ok) {
      return {
        error: validation.error,
        ok: false,
        riskPreview: createCreateManagerRiskPreview(validation.error.message),
        warnings: createManagerWarnings,
      };
    }

    const builderResult = buildCreateManagerTx({ sender: validation.sender });

    if (!builderResult.ok) {
      return {
        error: builderResult.error,
        ok: false,
        riskPreview: createCreateManagerRiskPreview(builderResult.error.message),
        warnings: createManagerWarnings,
      };
    }

    const preview: CreateManagerFlowPreview = {
      ...builderResult.preview,
      postTransactionRefreshKeys: createManagerRefreshKeys(),
    };

    return {
      builderPreview: preview,
      executionRequest: builderResult.executionRequest,
      ok: true,
      riskPreview: createCreateManagerRiskPreview(),
      warnings: createManagerWarnings,
    };
  };

  const flow = usePredictTradeExecutionFlow({
    action: 'CREATE_MANAGER',
    copy: createManagerFlowCopy,
    executionTransport,
    prepareReview,
    queryClient,
    simulationTransport,
  });

  return {
    beginCreateManagerReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}

function validateCreateManagerPreconditions({
  hasExistingManager,
  walletStatus,
}: {
  hasExistingManager: boolean;
  walletStatus: WalletStatusModel;
}):
  | {
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
    } {
  if (!walletStatus.isConnected || walletStatus.accountAddress === null) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: { action: 'CREATE_MANAGER' },
      }),
      ok: false,
    };
  }

  if (!walletStatus.isExpectedNetwork || walletStatus.isWrongNetwork) {
    return {
      error: createAppError('WRONG_NETWORK', {
        context: {
          action: 'CREATE_MANAGER',
          currentNetwork: walletStatus.currentNetwork,
          expectedNetwork: walletStatus.expectedNetwork,
        },
      }),
      ok: false,
    };
  }

  if (hasExistingManager) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: { action: 'CREATE_MANAGER', field: 'manager' },
        message: 'A PredictManager is already selected for this wallet.',
        recovery: 'Reuse the existing PredictManager instead of creating another one.',
      }),
      ok: false,
    };
  }

  return {
    ok: true,
    sender: walletStatus.accountAddress as SuiAddress,
  };
}

function createManagerRefreshKeys() {
  return [predictQueryKeys.manager.list(), predictQueryKeys.manager.all()];
}

function createCreateManagerRiskPreview(errorMessage?: string): RiskPreviewModel {
  return {
    action: 'CREATE_MANAGER',
    blockers: errorMessage === undefined ? [] : [errorMessage],
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title: 'Create PredictManager',
    warnings: createManagerWarnings,
  };
}
