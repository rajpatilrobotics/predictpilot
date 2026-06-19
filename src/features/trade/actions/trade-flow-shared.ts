import { useState } from 'react';
import { predictDeploymentConfig } from '@/config/predict';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { RiskPreviewModel } from '@/features/tx/RiskPreview';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { OracleStatusModel } from '@/lib/oracle-status';
import type { OracleStateModel } from '@/types/oracle';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { ManagerSummaryModel } from '@/types/portfolio';
import type { PredictTransactionAction } from '@/types/tx';

export interface TradeFlowCopyBase {
  missingManagerSummaryMessage: string;
  missingManagerSummaryRecovery: string;
  reviewTitle: string;
  simulationRequiredMessage: string;
}

export interface TradeFlowWarning {
  message: string;
  severity?: 'info' | 'warning';
}

export function useStableInitialNowMs(nowMs: number | undefined) {
  const [initialNowMs] = useState(() => nowMs ?? Date.now());

  return initialNowMs;
}

export function validateTradeWalletManagerBase({
  action,
  copy,
  manager,
  managerSummary,
  walletStatus,
}: {
  action: PredictTransactionAction;
  copy: TradeFlowCopyBase;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  walletStatus: WalletStatusModel;
}):
  | {
      managerId: NonNullable<UsePredictManagerResult['managerId']>;
      managerSummary: ManagerSummaryModel;
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
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

  if (!manager.isReady || manager.managerId === null) {
    return {
      error: createAppError('MANAGER_NOT_FOUND', {
        context: {
          action,
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
          action,
          managerId: manager.managerId,
        },
        message: copy.missingManagerSummaryMessage,
        recovery: copy.missingManagerSummaryRecovery,
      }),
      ok: false,
    };
  }

  return {
    managerId: manager.managerId,
    managerSummary,
    ok: true,
    sender: walletStatus.accountAddress as SuiAddress,
  };
}

export function isOracleAvailabilityStale(reasonCodes: string[]) {
  return reasonCodes.some((code) =>
    ['ORACLE_PRICE_MISSING', 'ORACLE_STALE', 'ORACLE_SVI_MISSING'].includes(code),
  );
}

export function createSimulationRequiredRiskPreview({
  action,
  copy,
  expiryMs,
  managerSummary,
  oracleState,
  oracleStatus,
  quantityQuote,
  warnings,
}: {
  action: PredictTransactionAction;
  copy: TradeFlowCopyBase;
  expiryMs: bigint | number;
  managerSummary: ManagerSummaryModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  warnings: TradeFlowWarning[];
}): RiskPreviewModel {
  return {
    action,
    askBoundsStatus: oracleState.askBounds.status,
    expiryMs,
    managerBalanceQuote: managerSummary.tradingBalanceQuote,
    managerId: managerSummary.managerId,
    oracleFreshness: oracleStatus.freshness.aggregateStatus,
    oracleId: oracleState.oracle.oracleId,
    oracleStatus: oracleStatus.lifecycleStatus,
    quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    title: copy.reviewTitle,
    underlyingAsset: oracleState.oracle.underlyingAsset,
    warnings: [
      ...warnings,
      {
        message: copy.simulationRequiredMessage,
        severity: 'warning',
      },
    ],
  };
}

export function createBlockedRiskPreview(options: {
  action: PredictTransactionAction;
  copy: TradeFlowCopyBase;
  error: PredictPilotError;
  expiryMs: bigint | number;
  managerSummary: ManagerSummaryModel;
  oracleState: OracleStateModel;
  oracleStatus: OracleStatusModel;
  quantityQuote: QuoteAmount;
  warnings: TradeFlowWarning[];
}): RiskPreviewModel {
  return {
    ...createSimulationRequiredRiskPreview(options),
    blockers: [options.error.message],
  };
}
