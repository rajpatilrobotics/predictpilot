import type { QueryClient } from '@tanstack/react-query';
import {
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PreparePredictTradeReviewResult,
} from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import {
  buildSupplyVaultTx,
  type SupplyVaultTxPreview,
} from '@/integrations/deepbook-predict/tx/supply-vault';
import { createAppError } from '@/lib/errors';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';
import {
  createVaultRiskPreview,
  validateVaultActionBase,
  withWalletRefreshKeys,
} from './vault-flow-shared';

export type VaultSupplyFlowPhase = PredictTradeFlowPhase;
export type VaultSupplyFlowState = PredictTradeFlowState<SupplyVaultTxPreview>;

export interface UseVaultSupplyFlowOptions {
  executionTransport?: PredictTransactionTransport;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  vault?: VaultModel | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
}

export interface BeginVaultSupplyReviewInput {
  amountQuote?: QuoteAmount | null;
}

export type BeginVaultSupplyReviewResult =
  | {
      ok: true;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
      warnings: Array<{ message: string; severity?: 'info' | 'warning' }>;
    };

const vaultSupplyFlowCopy = {
  signatureNotReadyMessage:
    'Vault supply simulation must be ready before requesting a wallet signature.',
  statusLabel: 'useVaultSupplyFlow',
} as const;

const supplyWarnings = [
  {
    message: 'Exact PLP shares out require simulation or confirmed onchain execution.',
    severity: 'warning' as const,
  },
];

export function useVaultSupplyFlow({
  executionTransport,
  queryClient,
  simulationTransport,
  vault,
  walletDusdcBalanceQuote,
  walletStatus,
}: UseVaultSupplyFlowOptions) {
  const prepareReview = async ({
    amountQuote,
  }: BeginVaultSupplyReviewInput): Promise<
    PreparePredictTradeReviewResult<SupplyVaultTxPreview>
  > => {
    await Promise.resolve();

    const validation = validateSupplyPreconditions({
      amountQuote,
      vault,
      walletDusdcBalanceQuote,
      walletStatus,
    });

    if (!validation.ok) {
      return {
        error: validation.error,
        ok: false,
        riskPreview: createSupplyRiskPreview({
          amountQuote: typeof amountQuote === 'bigint' ? amountQuote : undefined,
          errorMessage: validation.error.message,
          vault,
        }),
        warnings: supplyWarnings,
      };
    }

    const builderResult = buildSupplyVaultTx({
      amountQuote: validation.amountQuote,
      sender: validation.sender,
      vault: validation.vault,
    });

    if (!builderResult.ok) {
      return {
        error: builderResult.error,
        ok: false,
        riskPreview: createSupplyRiskPreview({
          amountQuote: validation.amountQuote,
          errorMessage: builderResult.error.message,
          vault: validation.vault,
        }),
        warnings: supplyWarnings,
      };
    }

    const preview = withWalletRefreshKeys(builderResult.preview, validation.sender);

    return {
      builderPreview: preview,
      executionRequest: builderResult.executionRequest,
      ok: true,
      riskPreview: createSupplyRiskPreview({
        amountQuote: validation.amountQuote,
        vault: validation.vault,
      }),
      warnings: supplyWarnings,
    };
  };

  const flow = usePredictTradeExecutionFlow({
    action: 'SUPPLY',
    copy: vaultSupplyFlowCopy,
    executionTransport,
    prepareReview,
    queryClient,
    simulationTransport,
  });

  return {
    beginSupplyReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}

function validateSupplyPreconditions({
  amountQuote,
  vault,
  walletDusdcBalanceQuote,
  walletStatus,
}: {
  amountQuote?: QuoteAmount | null;
  vault?: VaultModel | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
}):
  | {
      amountQuote: QuoteAmount;
      ok: true;
      sender: SuiAddress;
      vault: VaultModel;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
    } {
  const baseValidation = validateVaultActionBase({
    action: 'SUPPLY',
    vault,
    walletStatus,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (typeof amountQuote !== 'bigint' || amountQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: { action: 'SUPPLY', field: 'amountQuote' },
        message: 'Vault supply amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before opening the supply execution review.',
      }),
      ok: false,
    };
  }

  if (walletDusdcBalanceQuote === null || walletDusdcBalanceQuote === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: { action: 'SUPPLY', field: 'walletDusdcBalanceQuote' },
        message: 'Wallet DUSDC balance is required before vault supply execution.',
        recovery: 'Refresh wallet DUSDC balance before opening the supply execution review.',
      }),
      ok: false,
    };
  }

  if (amountQuote > walletDusdcBalanceQuote) {
    return {
      error: createAppError('INSUFFICIENT_WALLET_DUSDC', {
        context: {
          action: 'SUPPLY',
          availableQuote: walletDusdcBalanceQuote.toString(),
          requestedQuote: amountQuote.toString(),
        },
      }),
      ok: false,
    };
  }

  return {
    amountQuote,
    ok: true,
    sender: baseValidation.sender,
    vault: baseValidation.vault,
  };
}

function createSupplyRiskPreview({
  amountQuote,
  errorMessage,
  vault,
}: {
  amountQuote?: QuoteAmount;
  errorMessage?: string;
  vault?: VaultModel | null;
}) {
  return createVaultRiskPreview({
    action: 'SUPPLY',
    amountQuote,
    errorMessage,
    title: 'Supply DUSDC to Predict vault',
    vault,
    warnings: supplyWarnings,
  });
}
