import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type {
  BinaryDirection,
  MarketKeyModel,
  ObjectId,
  QuoteAmount,
  SuiAddress,
} from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface BuildMintBinaryTxOptions {
  managerId?: ObjectId | null;
  marketKey?: MarketKeyModel | null;
  quantityQuote?: QuoteAmount | null;
  sender?: SuiAddress | null;
}

export interface MintBinaryTxPreview {
  action: Extract<PredictTransactionAction, 'MINT'>;
  affectedObjects: AffectedObjectHint[];
  description: string;
  direction: BinaryDirection;
  expectedNetwork: typeof predictDeploymentConfig.network;
  managerId: ObjectId;
  marketKey: MarketKeyModel;
  oracleId: ObjectId;
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  quoteAsset: PredictQuoteAssetConfig;
  sender: SuiAddress;
  target: typeof predictTxTargets.predict.mint;
  title: string;
}

export type BuildMintBinaryTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: MintBinaryTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedMintBinaryInputs =
  | {
      managerId: ObjectId;
      marketKey: MarketKeyModel;
      ok: true;
      quantityQuote: QuoteAmount;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const MINT_BINARY_ACTION = 'MINT' satisfies PredictTransactionAction;
const MINT_BINARY_DESCRIPTION =
  'Mint a binary position from the selected PredictManager balance.';

export function buildMintBinaryTx({
  managerId,
  marketKey,
  quantityQuote,
  sender,
}: BuildMintBinaryTxOptions = {}): BuildMintBinaryTxResult {
  const validation = validateMintBinaryInputs({
    managerId,
    marketKey,
    quantityQuote,
    sender,
  });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const binaryMarketKey = transaction.moveCall({
      arguments: [
        transaction.pure.id(validation.marketKey.oracleId),
        transaction.pure.u64(validation.marketKey.expiryMs),
        transaction.pure.u64(validation.marketKey.strike1e9),
      ],
      target: getMarketKeyTarget(validation.marketKey.direction),
    });

    transaction.moveCall({
      arguments: [
        transaction.object(predictDeploymentConfig.predictObjectId),
        transaction.object(validation.managerId),
        transaction.object(validation.marketKey.oracleId),
        binaryMarketKey,
        transaction.pure.u64(validation.quantityQuote),
        transaction.object.clock(),
      ],
      target: predictTxTargets.predict.mint,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    });

    const affectedObjects = createBinaryAffectedObjects(validation.managerId, validation.marketKey.oracleId);
    const postTransactionRefreshKeys = predictInvalidationKeys.afterManagerWrite({
      managerId: validation.managerId,
      oracleId: validation.marketKey.oracleId,
    });
    const preview: MintBinaryTxPreview = {
      action: MINT_BINARY_ACTION,
      affectedObjects,
      description: MINT_BINARY_DESCRIPTION,
      direction: validation.marketKey.direction,
      expectedNetwork: predictDeploymentConfig.network,
      managerId: validation.managerId,
      marketKey: validation.marketKey,
      oracleId: validation.marketKey.oracleId,
      postTransactionRefreshKeys,
      quantityQuote: validation.quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender: validation.sender,
      target: predictTxTargets.predict.mint,
      title: 'Mint binary position',
    };

    return {
      executionRequest: {
        action: MINT_BINARY_ACTION,
        affectedObjects,
        description: MINT_BINARY_DESCRIPTION,
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
          action: MINT_BINARY_ACTION,
          builder: 'buildMintBinaryTx',
          errorName: error instanceof Error ? error.name : typeof error,
          managerId: validation.managerId,
          oracleId: validation.marketKey.oracleId,
        },
      }),
      ok: false,
    };
  }
}

function validateMintBinaryInputs({
  managerId,
  marketKey,
  quantityQuote,
  sender,
}: BuildMintBinaryTxOptions): ValidatedMintBinaryInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: MINT_BINARY_ACTION,
          builder: 'buildMintBinaryTx',
        },
      }),
      ok: false,
    };
  }

  if (!hasValidObjectId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: MINT_BINARY_ACTION,
          builder: 'buildMintBinaryTx',
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: 'Select or create a PredictManager before minting a binary position.',
      }),
      ok: false,
    };
  }

  const marketKeyValidation = validateMarketKey(marketKey);
  if (!marketKeyValidation.ok) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: MINT_BINARY_ACTION,
          builder: 'buildMintBinaryTx',
          field: marketKeyValidation.field,
        },
        message: marketKeyValidation.message,
        recovery: 'Refresh oracle state and choose a valid binary market before minting.',
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: MINT_BINARY_ACTION,
          builder: 'buildMintBinaryTx',
          field: 'quantityQuote',
        },
        message: 'Mint quantity must be greater than zero.',
        recovery: 'Enter a positive quantity before building the binary mint transaction.',
      }),
      ok: false,
    };
  }

  return {
    managerId,
    marketKey: marketKeyValidation.marketKey,
    ok: true,
    quantityQuote,
    sender,
  };
}

function createBinaryAffectedObjects(managerId: ObjectId, oracleId: ObjectId): AffectedObjectHint[] {
  return [
    {
      id: predictDeploymentConfig.predictObjectId,
      kind: 'predict',
      label: 'Predict',
    },
    {
      id: managerId,
      kind: 'manager',
      label: 'PredictManager',
    },
    {
      id: oracleId,
      kind: 'oracle',
      label: 'OracleSVI',
    },
  ];
}

function getMarketKeyTarget(direction: BinaryDirection) {
  return direction === 'UP' ? predictTxTargets.marketKey.up : predictTxTargets.marketKey.down;
}

function hasConnectedSender(sender: BuildMintBinaryTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function hasPositiveQuoteAmount(
  quantityQuote: BuildMintBinaryTxOptions['quantityQuote'],
): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}

function validateMarketKey(
  marketKey: BuildMintBinaryTxOptions['marketKey'],
):
  | {
      marketKey: MarketKeyModel;
      ok: true;
    }
  | {
      field: keyof MarketKeyModel | 'marketKey';
      message: string;
      ok: false;
    } {
  if (marketKey === null || marketKey === undefined) {
    return {
      field: 'marketKey',
      message: 'A binary market key is required.',
      ok: false,
    };
  }

  if (!hasValidObjectId(marketKey.oracleId)) {
    return {
      field: 'oracleId',
      message: 'A valid OracleSVI object ID is required.',
      ok: false,
    };
  }

  if (marketKey.direction !== 'UP' && marketKey.direction !== 'DOWN') {
    return {
      field: 'direction',
      message: 'Binary market direction must be UP or DOWN.',
      ok: false,
    };
  }

  if (!isNonNegativeBigint(marketKey.expiryMs)) {
    return {
      field: 'expiryMs',
      message: 'Binary market expiry must be a non-negative integer timestamp.',
      ok: false,
    };
  }

  if (!isNonNegativeBigint(marketKey.strike1e9)) {
    return {
      field: 'strike1e9',
      message: 'Binary market strike must be a non-negative integer price.',
      ok: false,
    };
  }

  return {
    marketKey,
    ok: true,
  };
}

function isNonNegativeBigint(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n;
}
