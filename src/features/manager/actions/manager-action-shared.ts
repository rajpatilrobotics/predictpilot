import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { vaultWalletBalanceQueryKeys } from '@/features/vault/lib/vault-wallet-balances';
import { createAppError } from '@/lib/errors';
import { predictInvalidationKeys, predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

export type ManagerQuoteAction = 'DEPOSIT_QUOTE' | 'WITHDRAW_QUOTE';
export type ManagerActionError = ReturnType<typeof createAppError>;

export interface ManagerActionWarning {
  message: string;
  severity?: 'info' | 'warning';
}

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
