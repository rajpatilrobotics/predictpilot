import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import {
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PreparePredictTradeReviewResult,
} from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { vaultWalletBalanceQueryKeys } from '@/features/vault/lib/vault-wallet-balances';
import {
  buildWithdrawFromManagerTx,
  type WithdrawFromManagerTxPreview,
} from '@/integrations/deepbook-predict/tx/withdraw-manager';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import { predictInvalidationKeys, predictQueryKeys } from '@/lib/query-keys';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

export type ManagerWithdrawFlowPhase = PredictTradeFlowPhase;
export type ManagerWithdrawFlowPreview = WithdrawFromManagerTxPreview & {
  postTransactionRefreshKeys: QueryKey[];
};
export type ManagerWithdrawFlowState = PredictTradeFlowState<ManagerWithdrawFlowPreview>;

export interface UseManagerWithdrawFlowOptions {
  executionTransport?: PredictTransactionTransport;
  managerId: ObjectId | null;
  managerSummary?: ManagerSummaryPortfolioModel | null;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
}

export interface BeginManagerWithdrawReviewInput {
  amountQuote?: QuoteAmount | null;
}

const managerWithdrawFlowCopy = {
  signatureNotReadyMessage:
    'Manager withdraw simulation must be ready before requesting a wallet signature.',
  statusLabel: 'useManagerWithdrawFlow',
} as const;

const withdrawWarnings = [
  {
    message: 'Withdraw returns DUSDC from the PredictManager to the connected wallet after confirmation.',
    severity: 'info' as const,
  },
];

export function useManagerWithdrawFlow({
  executionTransport,
  managerId,
  managerSummary,
  queryClient,
  simulationTransport,
  walletStatus,
}: UseManagerWithdrawFlowOptions) {
  const prepareReview = async ({
    amountQuote,
  }: BeginManagerWithdrawReviewInput): Promise<
    PreparePredictTradeReviewResult<ManagerWithdrawFlowPreview>
  > => {
    await Promise.resolve();

    const validation = validateWithdrawPreconditions({
      amountQuote,
      managerId,
      managerSummary,
      walletStatus,
    });

    if (!validation.ok) {
      return {
        error: validation.error,
        ok: false,
        riskPreview: createWithdrawRiskPreview({
          amountQuote: typeof amountQuote === 'bigint' ? amountQuote : undefined,
          errorMessage: validation.error.message,
          managerBalanceQuote: managerSummary?.balanceSummary.tradingBalanceQuote,
          managerId,
        }),
        warnings: withdrawWarnings,
      };
    }

    const builderResult = buildWithdrawFromManagerTx({
      amountQuote: validation.amountQuote,
      managerId: validation.managerId,
      sender: validation.sender,
    });

    if (!builderResult.ok) {
      return {
        error: builderResult.error,
        ok: false,
        riskPreview: createWithdrawRiskPreview({
          amountQuote: validation.amountQuote,
          errorMessage: builderResult.error.message,
          managerBalanceQuote: validation.managerBalanceQuote,
          managerId: validation.managerId,
        }),
        warnings: withdrawWarnings,
      };
    }

    const preview: ManagerWithdrawFlowPreview = {
      ...builderResult.preview,
      postTransactionRefreshKeys: managerWriteRefreshKeys({
        managerId: validation.managerId,
        sender: validation.sender,
      }),
    };

    return {
      builderPreview: preview,
      executionRequest: builderResult.executionRequest,
      ok: true,
      riskPreview: createWithdrawRiskPreview({
        amountQuote: validation.amountQuote,
        managerBalanceQuote: validation.managerBalanceQuote,
        managerId: validation.managerId,
      }),
      warnings: withdrawWarnings,
    };
  };

  const flow = usePredictTradeExecutionFlow({
    action: 'WITHDRAW_QUOTE',
    copy: managerWithdrawFlowCopy,
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
  amountQuote,
  managerId,
  managerSummary,
  walletStatus,
}: {
  amountQuote?: QuoteAmount | null;
  managerId: ObjectId | null;
  managerSummary?: ManagerSummaryPortfolioModel | null;
  walletStatus: WalletStatusModel;
}):
  | {
      amountQuote: QuoteAmount;
      managerBalanceQuote: QuoteAmount;
      managerId: ObjectId;
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
    } {
  const baseValidation = validateManagerActionBase({
    action: 'WITHDRAW_QUOTE',
    managerId,
    walletStatus,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (typeof amountQuote !== 'bigint' || amountQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: { action: 'WITHDRAW_QUOTE', field: 'amountQuote' },
        message: 'Withdraw amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before opening the manager withdraw review.',
      }),
      ok: false,
    };
  }

  if (managerSummary === null || managerSummary === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: { action: 'WITHDRAW_QUOTE', field: 'managerSummary' },
        message: 'Manager balance is required before manager withdraw execution.',
        recovery: 'Refresh the manager summary before opening the withdraw review.',
      }),
      ok: false,
    };
  }

  const managerBalanceQuote = managerSummary.balanceSummary.tradingBalanceQuote;

  if (amountQuote > managerBalanceQuote) {
    return {
      error: createAppError('INSUFFICIENT_MANAGER_DUSDC', {
        context: {
          action: 'WITHDRAW_QUOTE',
          amountQuote: amountQuote.toString(),
          managerBalanceQuote: managerBalanceQuote.toString(),
        },
      }),
      ok: false,
    };
  }

  return {
    amountQuote,
    managerBalanceQuote,
    managerId: baseValidation.managerId,
    ok: true,
    sender: baseValidation.sender,
  };
}

function validateManagerActionBase({
  action,
  managerId,
  walletStatus,
}: {
  action: 'WITHDRAW_QUOTE';
  managerId: ObjectId | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: ObjectId;
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
        context: { action },
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

  if (managerId === null) {
    return {
      error: createAppError('MANAGER_NOT_FOUND', {
        context: { action },
      }),
      ok: false,
    };
  }

  return {
    managerId,
    ok: true,
    sender: walletStatus.accountAddress as SuiAddress,
  };
}

function managerWriteRefreshKeys({
  managerId,
  sender,
}: {
  managerId: ObjectId;
  sender: SuiAddress;
}): QueryKey[] {
  return [
    predictQueryKeys.manager.list(),
    ...predictInvalidationKeys.afterManagerWrite({ managerId }),
    vaultWalletBalanceQueryKeys.quote(sender),
  ];
}

function createWithdrawRiskPreview({
  amountQuote,
  errorMessage,
  managerBalanceQuote,
  managerId,
}: {
  amountQuote?: QuoteAmount;
  errorMessage?: string;
  managerBalanceQuote?: QuoteAmount;
  managerId: ObjectId | null;
}): RiskPreviewModel {
  return {
    action: 'WITHDRAW_QUOTE',
    amountQuote,
    blockers: errorMessage === undefined ? [] : [errorMessage],
    managerBalanceQuote,
    managerId: managerId ?? undefined,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title: 'Withdraw DUSDC from PredictManager',
    warnings: withdrawWarnings,
  };
}
