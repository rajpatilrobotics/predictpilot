import {
  previewPredictTransactionSimulation,
  type PredictPtbSimulationPreview,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import {
  buildSupplyVaultTx,
  type SupplyVaultTxPreview,
} from '@/integrations/deepbook-predict/tx/supply-vault';
import {
  buildWithdrawVaultTx,
  type WithdrawVaultTxPreview,
} from '@/integrations/deepbook-predict/tx/withdraw-vault';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { PredictTransactionExecutionRequest } from '@/types/tx';
import type { VaultModel } from '@/types/vault';
import type { Transaction } from '@mysten/sui/transactions';

export type VaultLpPreparationStatus = 'blocked' | 'error' | 'ready' | 'simulation-blocked';

export interface VaultLpSimulationOptions {
  checksEnabled?: boolean;
  enabled?: boolean;
  transport?: PredictSimulationTransport | null;
}

export interface PrepareVaultSupplyOptions {
  amountQuote?: QuoteAmount | null;
  sender?: SuiAddress | null;
  simulation?: VaultLpSimulationOptions;
  vault?: VaultModel | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
}

export interface PrepareVaultWithdrawOptions {
  plpAmountAtomic?: bigint | null;
  sender?: SuiAddress | null;
  simulation?: VaultLpSimulationOptions;
  vault?: VaultModel | null;
  walletPlpBalanceAtomic?: bigint | null;
}

export type PreparedVaultSupply = PreparedVaultLpAction<SupplyVaultTxPreview>;
export type PreparedVaultWithdraw = PreparedVaultLpAction<WithdrawVaultTxPreview>;

export type PreparedVaultLpAction<TPreview> =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      preview: TPreview;
      simulationPreview?: PredictPtbSimulationPreview;
      status: 'ready';
      transaction: Transaction;
      warnings: string[];
    }
  | {
      error: PredictPilotError;
      simulationPreview?: PredictPtbSimulationPreview;
      status: Exclude<VaultLpPreparationStatus, 'ready'>;
      warnings: string[];
    };

export async function prepareVaultSupply({
  amountQuote,
  sender,
  simulation,
  vault,
  walletDusdcBalanceQuote,
}: PrepareVaultSupplyOptions): Promise<PreparedVaultSupply> {
  if (walletDusdcBalanceQuote === null || walletDusdcBalanceQuote === undefined) {
    return blocked(
      createAppError('TODO_VERIFY_PATH_USED', {
        context: {
          action: 'SUPPLY',
          field: 'walletDusdcBalanceQuote',
          service: 'prepareVaultSupply',
        },
        message: 'Wallet DUSDC balance is required before preparing vault supply.',
        recovery: 'Refresh wallet DUSDC balance before preparing a vault supply transaction.',
      }),
      supplyWarnings(),
    );
  }

  if (typeof amountQuote === 'bigint' && amountQuote > walletDusdcBalanceQuote) {
    return blocked(
      createAppError('INSUFFICIENT_WALLET_DUSDC', {
        context: {
          action: 'SUPPLY',
          availableQuote: walletDusdcBalanceQuote.toString(),
          requestedQuote: amountQuote.toString(),
          service: 'prepareVaultSupply',
        },
      }),
      supplyWarnings(),
    );
  }

  const builderResult = buildSupplyVaultTx({ amountQuote, sender, vault });

  if (!builderResult.ok) {
    return builderError(builderResult.error, supplyWarnings());
  }

  return prepareSimulation({
    builderPreview: builderResult.preview,
    executionRequest: builderResult.executionRequest,
    simulation,
    transaction: builderResult.transaction,
    warnings: supplyWarnings(),
  });
}

export async function prepareVaultWithdraw({
  plpAmountAtomic,
  sender,
  simulation,
  vault,
  walletPlpBalanceAtomic,
}: PrepareVaultWithdrawOptions): Promise<PreparedVaultWithdraw> {
  const builderResult = buildWithdrawVaultTx({
    plpAmountAtomic,
    sender,
    vault,
    walletPlpBalanceAtomic,
  });

  if (!builderResult.ok) {
    return builderError(builderResult.error, withdrawWarnings());
  }

  return prepareSimulation({
    builderPreview: builderResult.preview,
    executionRequest: builderResult.executionRequest,
    simulation,
    transaction: builderResult.transaction,
    warnings: withdrawWarnings(),
  });
}

async function prepareSimulation<TPreview>({
  builderPreview,
  executionRequest,
  simulation,
  transaction,
  warnings,
}: {
  builderPreview: TPreview;
  executionRequest: PredictTransactionExecutionRequest;
  simulation?: VaultLpSimulationOptions;
  transaction: Transaction;
  warnings: string[];
}): Promise<PreparedVaultLpAction<TPreview>> {
  if (simulation?.enabled !== true) {
    return {
      executionRequest,
      preview: builderPreview,
      status: 'ready',
      transaction,
      warnings,
    };
  }

  const simulationPreview = await previewPredictTransactionSimulation({
    builderPreview,
    checksEnabled: simulation.checksEnabled,
    request: executionRequest,
    transport: simulation.transport,
  });

  if (simulationPreview.status === 'ready') {
    return {
      executionRequest,
      preview: builderPreview,
      simulationPreview,
      status: 'ready',
      transaction,
      warnings,
    };
  }

  if (simulationPreview.status === 'error') {
    return {
      error: simulationPreview.error,
      simulationPreview,
      status: 'error',
      warnings,
    };
  }

  if (simulationPreview.status === 'loading') {
    return {
      error: createAppError('SIMULATION_FAILED', {
        context: {
          action: executionRequest.action,
          service: 'prepareVaultLpSimulation',
          simulationStatus: 'loading',
        },
        message: 'Vault LP simulation did not complete.',
        recovery: 'Wait for simulation to finish before requesting wallet signing.',
      }),
      simulationPreview,
      status: 'simulation-blocked',
      warnings,
    };
  }

  return {
    error: simulationPreview.error,
    simulationPreview,
    status: 'simulation-blocked',
    warnings,
  };
}

function builderError<TPreview>(
  error: PredictPilotError,
  warnings: string[],
): PreparedVaultLpAction<TPreview> {
  return {
    error,
    status: error.code === 'PTB_BUILD_FAILED' ? 'error' : 'blocked',
    warnings,
  };
}

function blocked<TPreview>(
  error: PredictPilotError,
  warnings: string[],
): PreparedVaultLpAction<TPreview> {
  return {
    error,
    status: 'blocked',
    warnings,
  };
}

function supplyWarnings() {
  return ['Exact PLP shares out require simulation or confirmed onchain execution.'];
}

function withdrawWarnings() {
  return ['Exact DUSDC returned requires simulation or confirmed onchain execution.'];
}
