import type { QueryKey } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { vaultWalletBalanceQueryKeys } from '@/features/vault/lib/vault-wallet-balances';
import { createAppError } from '@/lib/errors';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

export type VaultExecutionAction = 'SUPPLY' | 'WITHDRAW';
export type VaultFlowError = ReturnType<typeof createAppError>;

export interface VaultFlowWarning {
  message: string;
  severity?: 'info' | 'warning';
}

export function validateVaultActionBase({
  action,
  vault,
  walletStatus,
}: {
  action: VaultExecutionAction;
  vault?: VaultModel | null;
  walletStatus: WalletStatusModel;
}):
  | {
      ok: true;
      sender: SuiAddress;
      vault: VaultModel;
    }
  | {
      error: VaultFlowError;
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

  if (vault === null || vault === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: { action, field: 'vault' },
        message: `Vault state is required before vault ${action.toLowerCase()} execution.`,
        recovery: `Refresh the vault summary before opening the ${action.toLowerCase()} execution review.`,
      }),
      ok: false,
    };
  }

  return {
    ok: true,
    sender: walletStatus.accountAddress as SuiAddress,
    vault,
  };
}

export function createVaultRiskPreview({
  action,
  amountQuote,
  errorMessage,
  plpAmountAtomic,
  title,
  vault,
  warnings,
}: {
  action: VaultExecutionAction;
  amountQuote?: QuoteAmount;
  errorMessage?: string;
  plpAmountAtomic?: bigint;
  title: string;
  vault?: VaultModel | null;
  warnings: VaultFlowWarning[];
}): RiskPreviewModel {
  return {
    action,
    amountQuote,
    availableWithdrawalQuote: vault?.availableWithdrawalQuote,
    plpAmountAtomic,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title,
    vaultValueQuote: vault?.vaultValueQuote,
    warnings,
    ...(errorMessage === undefined ? {} : { blockers: [errorMessage] }),
  };
}

export function withWalletRefreshKeys<TPreview extends { postTransactionRefreshKeys: QueryKey[] }>(
  preview: TPreview,
  sender: SuiAddress,
) {
  return {
    ...preview,
    postTransactionRefreshKeys: [
      ...preview.postTransactionRefreshKeys,
      vaultWalletBalanceQueryKeys.quote(sender),
      vaultWalletBalanceQueryKeys.plp(sender),
    ],
  };
}
