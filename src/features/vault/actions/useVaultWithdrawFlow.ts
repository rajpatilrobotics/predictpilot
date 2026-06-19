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
  buildWithdrawVaultTx,
  type WithdrawVaultTxPreview,
} from '@/integrations/deepbook-predict/tx/withdraw-vault';
import { createAppError } from '@/lib/errors';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';
import {
  createVaultRiskPreview,
  validateVaultActionBase,
  withWalletRefreshKeys,
} from './vault-flow-shared';

export type VaultWithdrawFlowPhase = PredictTradeFlowPhase;
export type VaultWithdrawFlowState = PredictTradeFlowState<WithdrawVaultTxPreview>;

export interface UseVaultWithdrawFlowOptions {
  executionTransport?: PredictTransactionTransport;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  vault?: VaultModel | null;
  walletPlpBalanceAtomic?: bigint | null;
  walletStatus: WalletStatusModel;
}

export interface BeginVaultWithdrawReviewInput {
  plpAmountAtomic?: bigint | null;
}

export type BeginVaultWithdrawReviewResult =
  | {
      ok: true;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
      warnings: Array<{ message: string; severity?: 'info' | 'warning' }>;
    };

const vaultWithdrawFlowCopy = {
  signatureNotReadyMessage:
    'Vault withdraw simulation must be ready before requesting a wallet signature.',
  statusLabel: 'useVaultWithdrawFlow',
} as const;

const withdrawWarnings = [
  {
    message: 'Exact DUSDC returned requires simulation or confirmed onchain execution.',
    severity: 'warning' as const,
  },
];

export function useVaultWithdrawFlow({
  executionTransport,
  queryClient,
  simulationTransport,
  vault,
  walletPlpBalanceAtomic,
  walletStatus,
}: UseVaultWithdrawFlowOptions) {
  const prepareReview = async ({
    plpAmountAtomic,
  }: BeginVaultWithdrawReviewInput): Promise<
    PreparePredictTradeReviewResult<WithdrawVaultTxPreview>
  > => {
    await Promise.resolve();

    const validation = validateWithdrawPreconditions({
      plpAmountAtomic,
      vault,
      walletPlpBalanceAtomic,
      walletStatus,
    });

    if (!validation.ok) {
      return {
        error: validation.error,
        ok: false,
        riskPreview: createWithdrawRiskPreview({
          errorMessage: validation.error.message,
          plpAmountAtomic: typeof plpAmountAtomic === 'bigint' ? plpAmountAtomic : undefined,
          vault,
        }),
        warnings: withdrawWarnings,
      };
    }

    const builderResult = buildWithdrawVaultTx({
      plpAmountAtomic: validation.plpAmountAtomic,
      sender: validation.sender,
      vault: validation.vault,
      walletPlpBalanceAtomic: validation.walletPlpBalanceAtomic,
    });

    if (!builderResult.ok) {
      return {
        error: builderResult.error,
        ok: false,
        riskPreview: createWithdrawRiskPreview({
          errorMessage: builderResult.error.message,
          plpAmountAtomic: validation.plpAmountAtomic,
          vault: validation.vault,
        }),
        warnings: withdrawWarnings,
      };
    }

    const preview = withWalletRefreshKeys(builderResult.preview, validation.sender);

    return {
      builderPreview: preview,
      executionRequest: builderResult.executionRequest,
      ok: true,
      riskPreview: createWithdrawRiskPreview({
        plpAmountAtomic: validation.plpAmountAtomic,
        vault: validation.vault,
      }),
      warnings: withdrawWarnings,
    };
  };

  const flow = usePredictTradeExecutionFlow({
    action: 'WITHDRAW',
    copy: vaultWithdrawFlowCopy,
    executionTransport,
    prepareReview,
    queryClient,
    simulationTransport,
  });

  return {
    beginWithdrawReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}

function validateWithdrawPreconditions({
  plpAmountAtomic,
  vault,
  walletPlpBalanceAtomic,
  walletStatus,
}: {
  plpAmountAtomic?: bigint | null;
  vault?: VaultModel | null;
  walletPlpBalanceAtomic?: bigint | null;
  walletStatus: WalletStatusModel;
}):
  | {
      ok: true;
      plpAmountAtomic: bigint;
      sender: SuiAddress;
      vault: VaultModel;
      walletPlpBalanceAtomic: bigint;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
    } {
  const baseValidation = validateVaultActionBase({
    action: 'WITHDRAW',
    vault,
    walletStatus,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (typeof plpAmountAtomic !== 'bigint' || plpAmountAtomic <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: { action: 'WITHDRAW', field: 'plpAmountAtomic' },
        message: 'Vault withdraw PLP amount must be greater than zero.',
        recovery: 'Enter a positive PLP amount before opening the withdraw execution review.',
      }),
      ok: false,
    };
  }

  if (walletPlpBalanceAtomic === null || walletPlpBalanceAtomic === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: { action: 'WITHDRAW', field: 'walletPlpBalanceAtomic' },
        message: 'Wallet PLP balance is required before vault withdraw execution.',
        recovery: 'Refresh wallet PLP balance before opening the withdraw execution review.',
      }),
      ok: false,
    };
  }

  if (walletPlpBalanceAtomic < plpAmountAtomic) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: 'WITHDRAW',
          availablePlp: walletPlpBalanceAtomic.toString(),
          requestedPlp: plpAmountAtomic.toString(),
        },
        message: 'The connected wallet does not have enough PLP for this withdrawal.',
        recovery: 'Lower the PLP amount or refresh wallet PLP balance before withdrawing.',
      }),
      ok: false,
    };
  }

  if (baseValidation.vault.availableWithdrawalQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: 'WITHDRAW',
          availableWithdrawalQuote: baseValidation.vault.availableWithdrawalQuote.toString(),
        },
        message: 'Vault withdrawal is currently unavailable.',
        recovery:
          'Withdrawals depend on current vault value and max payout coverage. Try a smaller amount later.',
      }),
      ok: false,
    };
  }

  return {
    ok: true,
    plpAmountAtomic,
    sender: baseValidation.sender,
    vault: baseValidation.vault,
    walletPlpBalanceAtomic,
  };
}

function createWithdrawRiskPreview({
  errorMessage,
  plpAmountAtomic,
  vault,
}: {
  errorMessage?: string;
  plpAmountAtomic?: bigint;
  vault?: VaultModel | null;
}) {
  return createVaultRiskPreview({
    action: 'WITHDRAW',
    errorMessage,
    plpAmountAtomic,
    title: 'Withdraw DUSDC from Predict vault',
    vault,
    warnings: withdrawWarnings,
  });
}
