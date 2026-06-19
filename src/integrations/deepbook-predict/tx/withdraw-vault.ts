import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type { MoveType, ObjectId, SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import type { VaultModel } from '@/types/vault';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface VaultWithdrawTxProtocolConfig {
  plpType?: MoveType;
  predictObjectId?: ObjectId;
  quoteAsset?: PredictQuoteAssetConfig;
  quoteAssetType?: MoveType;
  withdrawTarget?: typeof predictTxTargets.predict.withdraw;
}

export interface BuildWithdrawVaultTxOptions {
  plpAmountAtomic?: bigint | null;
  protocolConfig?: VaultWithdrawTxProtocolConfig;
  sender?: SuiAddress | null;
  vault?: VaultModel | null;
  walletPlpBalanceAtomic?: bigint | null;
}

export interface WithdrawVaultConsequence {
  amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED';
  coinType: MoveType;
  direction: 'RETURN_QUOTE';
}

export interface WithdrawVaultTxPreview {
  action: Extract<PredictTransactionAction, 'WITHDRAW'>;
  affectedObjects: AffectedObjectHint[];
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED';
  plpAmountAtomic: bigint;
  plpBurnConsequence: {
    amountAtomic: bigint;
    coinType: MoveType;
    direction: 'BURN_PLP';
  };
  postTransactionRefreshKeys: QueryKey[];
  predictId: ObjectId;
  quoteAsset: PredictQuoteAssetConfig;
  quoteConsequence: WithdrawVaultConsequence;
  sender: SuiAddress;
  target: typeof predictTxTargets.predict.withdraw;
  title: string;
  vaultSnapshot: WithdrawVaultSnapshot;
  walletPlpBalanceAtomic: bigint;
}

export interface WithdrawVaultSnapshot {
  availableWithdrawalQuote: bigint;
  maxPayoutUtilizationRatio: number;
  vaultValueQuote: bigint;
}

export type BuildWithdrawVaultTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: WithdrawVaultTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedWithdrawVaultInputs =
  | {
      ok: true;
      plpAmountAtomic: bigint;
      protocolConfig: Required<VaultWithdrawTxProtocolConfig>;
      sender: SuiAddress;
      vault: VaultModel;
      walletPlpBalanceAtomic: bigint;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const WITHDRAW_VAULT_ACTION = 'WITHDRAW' satisfies PredictTransactionAction;
const WITHDRAW_VAULT_DESCRIPTION =
  'Burn wallet PLP shares through the Predict vault and receive DUSDC in the connected wallet.';

export function buildWithdrawVaultTx({
  plpAmountAtomic,
  protocolConfig = defaultWithdrawVaultProtocolConfig(),
  sender,
  vault,
  walletPlpBalanceAtomic,
}: BuildWithdrawVaultTxOptions = {}): BuildWithdrawVaultTxResult {
  const validation = validateWithdrawVaultInputs({
    plpAmountAtomic,
    protocolConfig,
    sender,
    vault,
    walletPlpBalanceAtomic,
  });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const plpCoin = transaction.coin({
      balance: validation.plpAmountAtomic,
      type: validation.protocolConfig.plpType,
    });

    const quoteCoin = transaction.moveCall({
      arguments: [
        transaction.object(validation.protocolConfig.predictObjectId),
        plpCoin,
        transaction.object.clock(),
      ],
      target: validation.protocolConfig.withdrawTarget,
      typeArguments: [validation.protocolConfig.quoteAssetType],
    });

    transaction.transferObjects([quoteCoin], transaction.pure.address(validation.sender));

    const affectedObjects = createWithdrawAffectedObjects(
      validation.protocolConfig.predictObjectId,
    );
    const postTransactionRefreshKeys = predictInvalidationKeys.afterVaultWrite({
      predictId: validation.protocolConfig.predictObjectId,
    });
    const preview: WithdrawVaultTxPreview = {
      action: WITHDRAW_VAULT_ACTION,
      affectedObjects,
      description: WITHDRAW_VAULT_DESCRIPTION,
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: predictDeploymentConfig.network,
      plpAmountAtomic: validation.plpAmountAtomic,
      plpBurnConsequence: {
        amountAtomic: validation.plpAmountAtomic,
        coinType: validation.protocolConfig.plpType,
        direction: 'BURN_PLP',
      },
      postTransactionRefreshKeys,
      predictId: validation.protocolConfig.predictObjectId,
      quoteAsset: validation.protocolConfig.quoteAsset,
      quoteConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        coinType: validation.protocolConfig.quoteAssetType,
        direction: 'RETURN_QUOTE',
      },
      sender: validation.sender,
      target: validation.protocolConfig.withdrawTarget,
      title: 'Withdraw DUSDC from Predict vault',
      vaultSnapshot: {
        availableWithdrawalQuote: validation.vault.availableWithdrawalQuote,
        maxPayoutUtilizationRatio: validation.vault.maxPayoutUtilizationRatio,
        vaultValueQuote: validation.vault.vaultValueQuote,
      },
      walletPlpBalanceAtomic: validation.walletPlpBalanceAtomic,
    };

    return {
      executionRequest: {
        action: WITHDRAW_VAULT_ACTION,
        affectedObjects,
        description: WITHDRAW_VAULT_DESCRIPTION,
        sender: validation.sender,
        transaction,
      },
      ok: true,
      preview,
      transaction,
    };
  } catch (error) {
    return {
      error: createAppError('PTB_BUILD_FAILED', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          errorName: error instanceof Error ? error.name : typeof error,
          predictId: validation.protocolConfig.predictObjectId,
        },
      }),
      ok: false,
    };
  }
}

function validateWithdrawVaultInputs({
  plpAmountAtomic,
  protocolConfig,
  sender,
  vault,
  walletPlpBalanceAtomic,
}: Required<Pick<BuildWithdrawVaultTxOptions, 'protocolConfig'>> &
  Omit<BuildWithdrawVaultTxOptions, 'protocolConfig'>): ValidatedWithdrawVaultInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
        },
      }),
      ok: false,
    };
  }

  const configValidation = validateWithdrawProtocolConfig(protocolConfig);
  if (!configValidation.ok) {
    return {
      error: configValidation.error,
      ok: false,
    };
  }

  if (!hasPositivePlpAmount(plpAmountAtomic)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'plpAmountAtomic',
        },
        message: 'Vault withdraw PLP amount must be greater than zero.',
        recovery: 'Enter a positive PLP amount before building the vault withdraw transaction.',
      }),
      ok: false,
    };
  }

  if (walletPlpBalanceAtomic === null || walletPlpBalanceAtomic === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'walletPlpBalanceAtomic',
        },
        message: 'Wallet PLP balance is required before building a vault withdraw transaction.',
        recovery: 'Refresh wallet PLP balance before preparing a vault withdrawal.',
      }),
      ok: false,
    };
  }

  if (walletPlpBalanceAtomic < plpAmountAtomic) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'walletPlpBalanceAtomic',
        },
        message: 'The connected wallet does not have enough PLP for this withdrawal.',
        recovery: 'Lower the PLP amount or refresh wallet PLP balance before withdrawing.',
      }),
      ok: false,
    };
  }

  if (vault === null || vault === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'vault',
        },
        message: 'Vault state is required before building a vault withdraw transaction.',
        recovery: 'Refresh the vault summary before preparing a vault withdraw transaction.',
      }),
      ok: false,
    };
  }

  if (!vault.quoteAssetTypes.includes(configValidation.protocolConfig.quoteAssetType)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'quoteAssetType',
        },
        message: 'The vault summary does not include the configured DUSDC quote asset.',
        recovery: 'Refresh configuration and vault state before withdrawing liquidity.',
      }),
      ok: false,
    };
  }

  if (vault.availableWithdrawalQuote <= 0n) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_VAULT_ACTION,
          builder: 'buildWithdrawVaultTx',
          field: 'availableWithdrawalQuote',
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
    protocolConfig: configValidation.protocolConfig,
    sender,
    vault,
    walletPlpBalanceAtomic,
  };
}

function validateWithdrawProtocolConfig(protocolConfig: VaultWithdrawTxProtocolConfig):
  | {
      ok: true;
      protocolConfig: Required<VaultWithdrawTxProtocolConfig>;
    }
  | {
      error: PredictPilotError;
      ok: false;
    } {
  if (!hasValidObjectId(protocolConfig.predictObjectId)) {
    return missingProtocolConfig('predictObjectId');
  }

  if (!isMoveType(protocolConfig.quoteAssetType)) {
    return missingProtocolConfig('quoteAssetType');
  }

  if (!isMoveType(protocolConfig.plpType)) {
    return missingProtocolConfig('plpType');
  }

  if (protocolConfig.quoteAsset === undefined || !isMoveType(protocolConfig.quoteAsset.type)) {
    return missingProtocolConfig('quoteAsset');
  }

  if (protocolConfig.withdrawTarget !== predictTxTargets.predict.withdraw) {
    return missingProtocolConfig('withdrawTarget');
  }

  return {
    ok: true,
    protocolConfig: protocolConfig as Required<VaultWithdrawTxProtocolConfig>,
  };
}

function missingProtocolConfig(field: keyof VaultWithdrawTxProtocolConfig) {
  return {
    error: createAppError('TODO_VERIFY_PATH_USED', {
      context: {
        action: WITHDRAW_VAULT_ACTION,
        builder: 'buildWithdrawVaultTx',
        field,
      },
      message: 'Vault withdraw protocol configuration is incomplete.',
      recovery:
        'Verify the current DeepBook Predict deployment config before enabling vault withdraw.',
    }),
    ok: false as const,
  };
}

function createWithdrawAffectedObjects(predictId: ObjectId): AffectedObjectHint[] {
  return [
    {
      id: predictId,
      kind: 'predict',
      label: 'Predict vault',
    },
    {
      kind: 'plp-coin',
      label: 'Wallet PLP',
    },
    {
      kind: 'wallet-coin',
      label: 'Wallet DUSDC',
    },
  ];
}

function defaultWithdrawVaultProtocolConfig(): VaultWithdrawTxProtocolConfig {
  return {
    plpType: predictProtocolTypes.plpType,
    predictObjectId: predictDeploymentConfig.predictObjectId,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    quoteAssetType: predictProtocolTypes.quoteAssetType,
    withdrawTarget: predictTxTargets.predict.withdraw,
  };
}

function hasConnectedSender(sender: BuildWithdrawVaultTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasPositivePlpAmount(plpAmountAtomic: unknown): plpAmountAtomic is bigint {
  return typeof plpAmountAtomic === 'bigint' && plpAmountAtomic > 0n;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function isMoveType(value: unknown): value is MoveType {
  return typeof value === 'string' && /^0x[a-fA-F0-9]+::[^:]+::[^:]+$/.test(value);
}
