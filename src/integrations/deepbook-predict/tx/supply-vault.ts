import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type { MoveType, ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import type { VaultModel } from '@/types/vault';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface VaultTxProtocolConfig {
  plpType?: MoveType;
  predictObjectId?: ObjectId;
  quoteAsset?: PredictQuoteAssetConfig;
  quoteAssetType?: MoveType;
  supplyTarget?: typeof predictTxTargets.predict.supply;
}

export interface BuildSupplyVaultTxOptions {
  amountQuote?: QuoteAmount | null;
  protocolConfig?: VaultTxProtocolConfig;
  sender?: SuiAddress | null;
  vault?: VaultModel | null;
}

export interface SupplyVaultConsequence {
  amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED';
  coinType: MoveType;
  direction: 'MINT_PLP';
}

export interface SupplyVaultTxPreview {
  action: Extract<PredictTransactionAction, 'SUPPLY'>;
  affectedObjects: AffectedObjectHint[];
  amountQuote: QuoteAmount;
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED';
  plpConsequence: SupplyVaultConsequence;
  postTransactionRefreshKeys: QueryKey[];
  predictId: ObjectId;
  quoteAsset: PredictQuoteAssetConfig;
  sender: SuiAddress;
  target: typeof predictTxTargets.predict.supply;
  title: string;
  vaultSnapshot: SupplyVaultSnapshot;
}

export interface SupplyVaultSnapshot {
  availableLiquidityQuote: QuoteAmount;
  plpSharePrice: number;
  vaultValueQuote: QuoteAmount;
}

export type BuildSupplyVaultTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: SupplyVaultTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedSupplyVaultInputs =
  | {
      amountQuote: QuoteAmount;
      ok: true;
      protocolConfig: Required<VaultTxProtocolConfig>;
      sender: SuiAddress;
      vault: VaultModel;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const SUPPLY_VAULT_ACTION = 'SUPPLY' satisfies PredictTransactionAction;
const SUPPLY_VAULT_DESCRIPTION =
  'Supply wallet DUSDC to the Predict vault and receive PLP shares in the connected wallet.';

export function buildSupplyVaultTx({
  amountQuote,
  protocolConfig = defaultSupplyVaultProtocolConfig(),
  sender,
  vault,
}: BuildSupplyVaultTxOptions = {}): BuildSupplyVaultTxResult {
  const validation = validateSupplyVaultInputs({
    amountQuote,
    protocolConfig,
    sender,
    vault,
  });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const quoteCoin = transaction.coin({
      balance: validation.amountQuote,
      type: validation.protocolConfig.quoteAssetType,
    });

    const plpCoin = transaction.moveCall({
      arguments: [
        transaction.object(validation.protocolConfig.predictObjectId),
        quoteCoin,
        transaction.object.clock(),
      ],
      target: validation.protocolConfig.supplyTarget,
      typeArguments: [validation.protocolConfig.quoteAssetType],
    });

    transaction.transferObjects([plpCoin], transaction.pure.address(validation.sender));

    const affectedObjects = createSupplyAffectedObjects(validation.protocolConfig.predictObjectId);
    const postTransactionRefreshKeys = predictInvalidationKeys.afterVaultWrite({
      predictId: validation.protocolConfig.predictObjectId,
    });
    const preview: SupplyVaultTxPreview = {
      action: SUPPLY_VAULT_ACTION,
      affectedObjects,
      amountQuote: validation.amountQuote,
      description: SUPPLY_VAULT_DESCRIPTION,
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: predictDeploymentConfig.network,
      plpConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        coinType: validation.protocolConfig.plpType,
        direction: 'MINT_PLP',
      },
      postTransactionRefreshKeys,
      predictId: validation.protocolConfig.predictObjectId,
      quoteAsset: validation.protocolConfig.quoteAsset,
      sender: validation.sender,
      target: validation.protocolConfig.supplyTarget,
      title: 'Supply DUSDC to Predict vault',
      vaultSnapshot: {
        availableLiquidityQuote: validation.vault.availableLiquidityQuote,
        plpSharePrice: validation.vault.plpSharePrice,
        vaultValueQuote: validation.vault.vaultValueQuote,
      },
    };

    return {
      executionRequest: {
        action: SUPPLY_VAULT_ACTION,
        affectedObjects,
        description: SUPPLY_VAULT_DESCRIPTION,
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
          action: SUPPLY_VAULT_ACTION,
          builder: 'buildSupplyVaultTx',
          errorName: error instanceof Error ? error.name : typeof error,
          predictId: validation.protocolConfig.predictObjectId,
        },
      }),
      ok: false,
    };
  }
}

function validateSupplyVaultInputs({
  amountQuote,
  protocolConfig,
  sender,
  vault,
}: Required<Pick<BuildSupplyVaultTxOptions, 'protocolConfig'>> &
  Omit<BuildSupplyVaultTxOptions, 'protocolConfig'>): ValidatedSupplyVaultInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: SUPPLY_VAULT_ACTION,
          builder: 'buildSupplyVaultTx',
        },
      }),
      ok: false,
    };
  }

  const configValidation = validateSupplyProtocolConfig(protocolConfig);
  if (!configValidation.ok) {
    return {
      error: configValidation.error,
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(amountQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: SUPPLY_VAULT_ACTION,
          builder: 'buildSupplyVaultTx',
          field: 'amountQuote',
        },
        message: 'Vault supply amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before building the vault supply transaction.',
      }),
      ok: false,
    };
  }

  if (vault === null || vault === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: {
          action: SUPPLY_VAULT_ACTION,
          builder: 'buildSupplyVaultTx',
          field: 'vault',
        },
        message: 'Vault state is required before building a vault supply transaction.',
        recovery: 'Refresh the vault summary before preparing a vault supply transaction.',
      }),
      ok: false,
    };
  }

  if (!vault.quoteAssetTypes.includes(configValidation.protocolConfig.quoteAssetType)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: SUPPLY_VAULT_ACTION,
          builder: 'buildSupplyVaultTx',
          field: 'quoteAssetType',
        },
        message: 'The vault summary does not include the configured DUSDC quote asset.',
        recovery: 'Refresh configuration and vault state before supplying liquidity.',
      }),
      ok: false,
    };
  }

  return {
    amountQuote,
    ok: true,
    protocolConfig: configValidation.protocolConfig,
    sender,
    vault,
  };
}

function validateSupplyProtocolConfig(protocolConfig: VaultTxProtocolConfig):
  | {
      ok: true;
      protocolConfig: Required<VaultTxProtocolConfig>;
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

  if (protocolConfig.supplyTarget !== predictTxTargets.predict.supply) {
    return missingProtocolConfig('supplyTarget');
  }

  return {
    ok: true,
    protocolConfig: protocolConfig as Required<VaultTxProtocolConfig>,
  };
}

function missingProtocolConfig(field: keyof VaultTxProtocolConfig) {
  return {
    error: createAppError('TODO_VERIFY_PATH_USED', {
      context: {
        action: SUPPLY_VAULT_ACTION,
        builder: 'buildSupplyVaultTx',
        field,
      },
      message: 'Vault supply protocol configuration is incomplete.',
      recovery:
        'Verify the current DeepBook Predict deployment config before enabling vault supply.',
    }),
    ok: false as const,
  };
}

function createSupplyAffectedObjects(predictId: ObjectId): AffectedObjectHint[] {
  return [
    {
      id: predictId,
      kind: 'predict',
      label: 'Predict vault',
    },
    {
      kind: 'wallet-coin',
      label: 'Wallet DUSDC',
    },
    {
      kind: 'plp-coin',
      label: 'Wallet PLP',
    },
  ];
}

function defaultSupplyVaultProtocolConfig(): VaultTxProtocolConfig {
  return {
    plpType: predictProtocolTypes.plpType,
    predictObjectId: predictDeploymentConfig.predictObjectId,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    quoteAssetType: predictProtocolTypes.quoteAssetType,
    supplyTarget: predictTxTargets.predict.supply,
  };
}

function hasConnectedSender(sender: BuildSupplyVaultTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasPositiveQuoteAmount(
  amountQuote: BuildSupplyVaultTxOptions['amountQuote'],
): amountQuote is QuoteAmount {
  return typeof amountQuote === 'bigint' && amountQuote > 0n;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function isMoveType(value: unknown): value is MoveType {
  return typeof value === 'string' && /^0x[a-fA-F0-9]+::[^:]+::[^:]+$/.test(value);
}
