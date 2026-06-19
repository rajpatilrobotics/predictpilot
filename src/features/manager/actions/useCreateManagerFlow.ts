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
  getManagers,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import {
  buildCreateManagerTx,
  type CreateManagerTxPreview,
} from '@/integrations/deepbook-predict/tx/create-manager';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { SuiAddress } from '@/types/predict';
import type { PredictManagerCreatedModel } from '@/types/portfolio';

export type CreateManagerFlowPhase = PredictTradeFlowPhase;
export type CreateManagerFlowPreview = CreateManagerTxPreview & {
  postTransactionRefreshKeys: ReturnType<typeof createManagerRefreshKeys>;
};
export type CreateManagerFlowState = PredictTradeFlowState<CreateManagerFlowPreview>;

export interface UseCreateManagerFlowOptions {
  executionTransport?: PredictTransactionTransport;
  hasExistingManager?: boolean;
  indexedClient?: PortfolioReadClient;
  managerRecoveryMaxAttempts?: number;
  managerRecoveryPollDelayMs?: number;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
  walletReturnTimeoutMs?: number;
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
  indexedClient,
  managerRecoveryMaxAttempts = 15,
  managerRecoveryPollDelayMs = 2_000,
  queryClient,
  simulationTransport,
  walletStatus,
  walletReturnTimeoutMs,
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
    recoverSubmittedTransaction: async ({ executionRequest, requestedAtMs }) => {
      if (walletStatus.accountAddress === null) {
        return null;
      }

      const manager = await recoverCreatedManagerFromIndex({
        client: indexedClient,
        maxAttempts: managerRecoveryMaxAttempts,
        owner: walletStatus.accountAddress as SuiAddress,
        pollDelayMs: managerRecoveryPollDelayMs,
        requestedAtMs,
      });

      if (manager === null) {
        return null;
      }

      return {
        affectedObjects: [
          ...(executionRequest.affectedObjects ?? []),
          {
            id: manager.managerId,
            kind: 'manager' as const,
            label: 'Recovered PredictManager',
          },
        ],
        confirmedStatus: 'success' as const,
        description:
          'Recovered create-manager digest from the Predict server manager index after wallet handoff.',
        digest: manager.digest,
      };
    },
    simulationTransport,
    walletReturnTimeoutMs,
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

async function recoverCreatedManagerFromIndex({
  client,
  maxAttempts,
  owner,
  pollDelayMs,
  requestedAtMs,
}: {
  client?: PortfolioReadClient;
  maxAttempts: number;
  owner: SuiAddress;
  pollDelayMs: number;
  requestedAtMs: number;
}): Promise<PredictManagerCreatedModel | null> {
  const requestWindowStartMs = BigInt(Math.max(0, requestedAtMs - 120_000));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matchingManager = selectNewestRecoveredManager({
      managers: await getManagers(client === undefined ? {} : { client }),
      owner,
      requestWindowStartMs,
    });

    if (matchingManager !== null) {
      return matchingManager;
    }

    if (attempt < maxAttempts - 1 && pollDelayMs > 0) {
      await sleep(pollDelayMs);
    }
  }

  return null;
}

function selectNewestRecoveredManager({
  managers,
  owner,
  requestWindowStartMs,
}: {
  managers: PredictManagerCreatedModel[];
  owner: SuiAddress;
  requestWindowStartMs: bigint;
}) {
  const ownerLower = owner.toLowerCase();
  const candidates = managers
    .filter(
      (manager) =>
        manager.owner.toLowerCase() === ownerLower &&
        manager.checkpointTimestampMs >= requestWindowStartMs,
    )
    .sort(compareManagersNewestFirst);

  return candidates[0] ?? null;
}

function compareManagersNewestFirst(
  left: PredictManagerCreatedModel,
  right: PredictManagerCreatedModel,
) {
  if (left.checkpointTimestampMs !== right.checkpointTimestampMs) {
    return left.checkpointTimestampMs > right.checkpointTimestampMs ? -1 : 1;
  }

  if (left.txIndex !== right.txIndex) {
    return right.txIndex - left.txIndex;
  }

  return right.eventIndex - left.eventIndex;
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    const timeoutId = globalThis.setTimeout(() => {
      globalThis.clearTimeout(timeoutId);
      resolve();
    }, delayMs);
  });
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
