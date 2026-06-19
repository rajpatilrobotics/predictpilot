import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  usePredictTradeExecutionFlow,
  type PredictTradeFlowPhase,
  type PredictTradeFlowState,
  type PreparePredictTradeReviewResult,
} from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import {
  buildDepositToManagerTx,
  type DepositToManagerTxPreview,
} from '@/integrations/deepbook-predict/tx/deposit-manager';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';
import type { AuthoritativeSuiClient } from '@/integrations/deepbook-predict/onchain/objects';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { ObjectId, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import {
  createManagerQuoteRiskPreview,
  managerWriteRefreshKeys,
  recoverManagerQuoteActionDigest,
  validateManagerActionBase,
} from './manager-action-shared';

export type ManagerDepositFlowPhase = PredictTradeFlowPhase;
export type ManagerDepositFlowPreview = DepositToManagerTxPreview & {
  postTransactionRefreshKeys: QueryKey[];
};
export type ManagerDepositFlowState = PredictTradeFlowState<ManagerDepositFlowPreview>;

export interface UseManagerDepositFlowOptions {
  authoritativeClient?: AuthoritativeSuiClient;
  executionTransport?: PredictTransactionTransport;
  indexedClient?: PortfolioReadClient;
  managerId: ObjectId | null;
  managerRecoveryMaxAttempts?: number;
  managerRecoveryPollDelayMs?: number;
  previousManagerTransactionDigest?: TransactionDigest | null;
  previousTradingBalanceQuote?: QuoteAmount | null;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
  walletReturnTimeoutMs?: number;
}

export interface BeginManagerDepositReviewInput {
  amountQuote?: QuoteAmount | null;
}

const managerDepositFlowCopy = {
  signatureNotReadyMessage:
    'Manager deposit simulation must be ready before requesting a wallet signature.',
  statusLabel: 'useManagerDepositFlow',
} as const;

const depositWarnings = [
  {
    message:
      'Manager and wallet balances refresh after confirmed execution; no optimistic balance is shown.',
    severity: 'info' as const,
  },
];

export function useManagerDepositFlow({
  authoritativeClient,
  executionTransport,
  indexedClient,
  managerId,
  managerRecoveryMaxAttempts,
  managerRecoveryPollDelayMs,
  previousManagerTransactionDigest,
  previousTradingBalanceQuote,
  queryClient,
  simulationTransport,
  walletDusdcBalanceQuote,
  walletStatus,
  walletReturnTimeoutMs,
}: UseManagerDepositFlowOptions) {
  const prepareReview = async ({
    amountQuote,
  }: BeginManagerDepositReviewInput): Promise<
    PreparePredictTradeReviewResult<ManagerDepositFlowPreview>
  > => {
    await Promise.resolve();

    const validation = validateDepositPreconditions({
      amountQuote,
      managerId,
      walletDusdcBalanceQuote,
      walletStatus,
    });

    if (!validation.ok) {
      return {
        error: validation.error,
        ok: false,
        riskPreview: createDepositRiskPreview({
          amountQuote: typeof amountQuote === 'bigint' ? amountQuote : undefined,
          errorMessage: validation.error.message,
          managerId,
          walletDusdcBalanceQuote,
        }),
        warnings: depositWarnings,
      };
    }

    const builderResult = buildDepositToManagerTx({
      amountQuote: validation.amountQuote,
      managerId: validation.managerId,
      sender: validation.sender,
    });

    if (!builderResult.ok) {
      return {
        error: builderResult.error,
        ok: false,
        riskPreview: createDepositRiskPreview({
          amountQuote: validation.amountQuote,
          errorMessage: builderResult.error.message,
          managerId: validation.managerId,
          walletDusdcBalanceQuote,
        }),
        warnings: depositWarnings,
      };
    }

    const preview: ManagerDepositFlowPreview = {
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
      riskPreview: createDepositRiskPreview({
        amountQuote: validation.amountQuote,
        managerId: validation.managerId,
        walletDusdcBalanceQuote,
      }),
      warnings: depositWarnings,
    };
  };

  const flow = usePredictTradeExecutionFlow({
    action: 'DEPOSIT_QUOTE',
    copy: managerDepositFlowCopy,
    executionTransport,
    prepareReview,
    queryClient,
    recoverSubmittedTransaction: async ({ builderPreview }) =>
      recoverManagerQuoteActionDigest({
        action: 'DEPOSIT_QUOTE',
        amountQuote: builderPreview.amountQuote,
        authoritativeClient,
        expectedBalanceDirection: 'increase',
        indexedClient,
        managerId: builderPreview.managerId,
        maxAttempts: managerRecoveryMaxAttempts,
        pollDelayMs: managerRecoveryPollDelayMs,
        previousManagerTransactionDigest,
        previousTradingBalanceQuote,
      }),
    simulationTransport,
    walletReturnTimeoutMs,
  });

  return {
    beginDepositReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}

function validateDepositPreconditions({
  amountQuote,
  managerId,
  walletDusdcBalanceQuote,
  walletStatus,
}: {
  amountQuote?: QuoteAmount | null;
  managerId: ObjectId | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus: WalletStatusModel;
}):
  | {
      amountQuote: QuoteAmount;
      managerId: ObjectId;
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: ReturnType<typeof createAppError>;
      ok: false;
    } {
  const baseValidation = validateManagerActionBase({
    action: 'DEPOSIT_QUOTE',
    managerId,
    walletStatus,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (typeof amountQuote !== 'bigint' || amountQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: { action: 'DEPOSIT_QUOTE', field: 'amountQuote' },
        message: 'Deposit amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before opening the deposit review.',
      }),
      ok: false,
    };
  }

  if (walletDusdcBalanceQuote === null || walletDusdcBalanceQuote === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: { action: 'DEPOSIT_QUOTE', field: 'walletDusdcBalanceQuote' },
        message: 'Wallet DUSDC balance is required before manager deposit execution.',
        recovery: 'Refresh wallet DUSDC before opening the manager deposit review.',
      }),
      ok: false,
    };
  }

  if (amountQuote > walletDusdcBalanceQuote) {
    return {
      error: createAppError('INSUFFICIENT_WALLET_DUSDC', {
        context: {
          action: 'DEPOSIT_QUOTE',
          amountQuote: amountQuote.toString(),
          walletDusdcBalanceQuote: walletDusdcBalanceQuote.toString(),
        },
      }),
      ok: false,
    };
  }

  return {
    amountQuote,
    managerId: baseValidation.managerId,
    ok: true,
    sender: baseValidation.sender,
  };
}

function createDepositRiskPreview({
  amountQuote,
  errorMessage,
  managerId,
  walletDusdcBalanceQuote,
}: {
  amountQuote?: QuoteAmount;
  errorMessage?: string;
  managerId: ObjectId | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
}) {
  return createManagerQuoteRiskPreview({
    action: 'DEPOSIT_QUOTE',
    amountQuote,
    balanceQuote: walletDusdcBalanceQuote,
    errorMessage,
    managerId,
    title: 'Deposit DUSDC to PredictManager',
    warnings: depositWarnings,
  });
}
