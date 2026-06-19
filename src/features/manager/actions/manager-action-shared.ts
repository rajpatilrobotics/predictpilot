import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getManagerSummary,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import {
  readAuthoritativeManagerObject,
  type AuthoritativeSuiClient,
} from '@/integrations/deepbook-predict/onchain/objects';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { PredictSubmittedTransactionRecoveryResult } from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { vaultWalletBalanceQueryKeys } from '@/features/vault/lib/vault-wallet-balances';
import { createAppError } from '@/lib/errors';
import { predictInvalidationKeys, predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';

export type ManagerQuoteAction = 'DEPOSIT_QUOTE' | 'WITHDRAW_QUOTE';
export type ManagerActionError = ReturnType<typeof createAppError>;

export interface ManagerActionWarning {
  message: string;
  severity?: 'info' | 'warning';
}

export interface RecoverManagerQuoteActionOptions {
  action: ManagerQuoteAction;
  amountQuote: QuoteAmount;
  authoritativeClient?: AuthoritativeSuiClient;
  expectedBalanceDirection: 'increase' | 'decrease';
  indexedClient?: PortfolioReadClient;
  managerId: ObjectId;
  maxAttempts?: number;
  pollDelayMs?: number;
  previousManagerTransactionDigest?: TransactionDigest | null;
  previousTradingBalanceQuote?: QuoteAmount | null;
}

const DEFAULT_MANAGER_ACTION_RECOVERY_ATTEMPTS = 4;
const DEFAULT_MANAGER_ACTION_RECOVERY_POLL_DELAY_MS = 2_000;

export function validateManagerActionBase({
  action,
  managerId,
  walletStatus,
}: {
  action: ManagerQuoteAction;
  managerId: ObjectId | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: ObjectId;
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: ManagerActionError;
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

export async function recoverManagerQuoteActionDigest({
  action,
  amountQuote,
  authoritativeClient,
  expectedBalanceDirection,
  indexedClient,
  managerId,
  maxAttempts = DEFAULT_MANAGER_ACTION_RECOVERY_ATTEMPTS,
  pollDelayMs = DEFAULT_MANAGER_ACTION_RECOVERY_POLL_DELAY_MS,
  previousManagerTransactionDigest,
  previousTradingBalanceQuote,
}: RecoverManagerQuoteActionOptions): Promise<PredictSubmittedTransactionRecoveryResult | null> {
  if (previousManagerTransactionDigest === null || previousManagerTransactionDigest === undefined) {
    return null;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const managerObject = await readAuthoritativeManagerObject({
      client: authoritativeClient,
      includeJson: false,
      managerId,
    });
    const recoveredDigest = managerObject.previousTransaction;

    if (
      recoveredDigest !== null &&
      recoveredDigest !== previousManagerTransactionDigest &&
      (await hasRecoveredManagerBalanceMove({
        amountQuote,
        expectedBalanceDirection,
        indexedClient,
        managerId,
        previousTradingBalanceQuote,
      }))
    ) {
      return {
        confirmedStatus: 'success',
        description: createManagerActionRecoveryDescription(action),
        digest: recoveredDigest,
      };
    }

    if (attempt < maxAttempts - 1) {
      await delay(pollDelayMs);
    }
  }

  return null;
}

export function managerWriteRefreshKeys({
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

export function createManagerQuoteRiskPreview({
  action,
  amountQuote,
  balanceQuote,
  errorMessage,
  managerId,
  title,
  warnings,
}: {
  action: ManagerQuoteAction;
  amountQuote?: QuoteAmount;
  balanceQuote?: QuoteAmount | null;
  errorMessage?: string;
  managerId: ObjectId | null;
  title: string;
  warnings: ManagerActionWarning[];
}): RiskPreviewModel {
  return {
    action,
    amountQuote,
    blockers: errorMessage === undefined ? [] : [errorMessage],
    managerBalanceQuote: balanceQuote ?? undefined,
    managerId: managerId ?? undefined,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title,
    warnings,
  };
}

async function hasRecoveredManagerBalanceMove({
  amountQuote,
  expectedBalanceDirection,
  indexedClient,
  managerId,
  previousTradingBalanceQuote,
}: {
  amountQuote: QuoteAmount;
  expectedBalanceDirection: 'increase' | 'decrease';
  indexedClient?: PortfolioReadClient;
  managerId: ObjectId;
  previousTradingBalanceQuote?: QuoteAmount | null;
}): Promise<boolean> {
  const summary = await getManagerSummary({
    client: indexedClient,
    managerId,
  });
  const currentBalance = summary.tradingBalanceQuote;

  if (previousTradingBalanceQuote === null || previousTradingBalanceQuote === undefined) {
    return expectedBalanceDirection === 'increase' ? currentBalance >= amountQuote : true;
  }

  const expectedBalance =
    expectedBalanceDirection === 'increase'
      ? previousTradingBalanceQuote + amountQuote
      : previousTradingBalanceQuote - amountQuote;

  if (expectedBalanceDirection === 'increase') {
    return currentBalance >= expectedBalance;
  }

  return previousTradingBalanceQuote >= amountQuote && currentBalance <= expectedBalance;
}

function createManagerActionRecoveryDescription(action: ManagerQuoteAction): string {
  return action === 'DEPOSIT_QUOTE'
    ? 'Recovered confirmed manager deposit digest from authoritative manager state.'
    : 'Recovered confirmed manager withdraw digest from authoritative manager state.';
}

async function delay(delayMs: number) {
  if (delayMs <= 0) {
    await Promise.resolve();
    return;
  }

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    await new Promise<void>((resolve) => {
      timeoutId = globalThis.setTimeout(resolve, delayMs);
    });
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
