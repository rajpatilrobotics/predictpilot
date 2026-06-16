import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type { ObjectId, QuoteAmount, RangeKeyModel, SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface BuildMintRangeTxOptions {
  managerId?: ObjectId | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
  sender?: SuiAddress | null;
}

export interface MintRangeTxPreview {
  action: Extract<PredictTransactionAction, 'MINT_RANGE'>;
  affectedObjects: AffectedObjectHint[];
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  managerId: ObjectId;
  oracleId: ObjectId;
  postTransactionRefreshKeys: QueryKey[];
  quantityQuote: QuoteAmount;
  quoteAsset: PredictQuoteAssetConfig;
  rangeKey: RangeKeyModel;
  sender: SuiAddress;
  target: typeof predictTxTargets.predict.mintRange;
  title: string;
}

export type BuildMintRangeTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: MintRangeTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedMintRangeInputs =
  | {
      managerId: ObjectId;
      ok: true;
      quantityQuote: QuoteAmount;
      rangeKey: RangeKeyModel;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const MINT_RANGE_ACTION = 'MINT_RANGE' satisfies PredictTransactionAction;
const MINT_RANGE_DESCRIPTION =
  'Mint a range position from the selected PredictManager balance.';

export function buildMintRangeTx({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildMintRangeTxOptions = {}): BuildMintRangeTxResult {
  const validation = validateMintRangeInputs({ managerId, quantityQuote, rangeKey, sender });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const verticalRangeKey = transaction.moveCall({
      arguments: [
        transaction.pure.id(validation.rangeKey.oracleId),
        transaction.pure.u64(validation.rangeKey.expiryMs),
        transaction.pure.u64(validation.rangeKey.lowerStrike1e9),
        transaction.pure.u64(validation.rangeKey.higherStrike1e9),
      ],
      target: predictTxTargets.rangeKey.new,
    });

    transaction.moveCall({
      arguments: [
        transaction.object(predictDeploymentConfig.predictObjectId),
        transaction.object(validation.managerId),
        transaction.object(validation.rangeKey.oracleId),
        verticalRangeKey,
        transaction.pure.u64(validation.quantityQuote),
        transaction.object.clock(),
      ],
      target: predictTxTargets.predict.mintRange,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    });

    const affectedObjects = createRangeAffectedObjects(
      validation.managerId,
      validation.rangeKey.oracleId,
    );
    const postTransactionRefreshKeys = predictInvalidationKeys.afterManagerWrite({
      managerId: validation.managerId,
      oracleId: validation.rangeKey.oracleId,
    });
    const preview: MintRangeTxPreview = {
      action: MINT_RANGE_ACTION,
      affectedObjects,
      description: MINT_RANGE_DESCRIPTION,
      expectedNetwork: predictDeploymentConfig.network,
      managerId: validation.managerId,
      oracleId: validation.rangeKey.oracleId,
      postTransactionRefreshKeys,
      quantityQuote: validation.quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: validation.rangeKey,
      sender: validation.sender,
      target: predictTxTargets.predict.mintRange,
      title: 'Mint range position',
    };

    return {
      executionRequest: {
        action: MINT_RANGE_ACTION,
        affectedObjects,
        description: MINT_RANGE_DESCRIPTION,
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
          action: MINT_RANGE_ACTION,
          builder: 'buildMintRangeTx',
          errorName: error instanceof Error ? error.name : typeof error,
          managerId: validation.managerId,
          oracleId: validation.rangeKey.oracleId,
        },
      }),
      ok: false,
    };
  }
}

function validateMintRangeInputs({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildMintRangeTxOptions): ValidatedMintRangeInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: MINT_RANGE_ACTION,
          builder: 'buildMintRangeTx',
        },
      }),
      ok: false,
    };
  }

  if (!hasValidObjectId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: MINT_RANGE_ACTION,
          builder: 'buildMintRangeTx',
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: 'Select or create a PredictManager before minting a range position.',
      }),
      ok: false,
    };
  }

  const rangeKeyValidation = validateRangeKey(rangeKey);
  if (!rangeKeyValidation.ok) {
    return {
      error: createAppError(rangeKeyValidation.code, {
        context: {
          action: MINT_RANGE_ACTION,
          builder: 'buildMintRangeTx',
          field: rangeKeyValidation.field,
        },
        message: rangeKeyValidation.message,
        recovery: 'Refresh oracle state and choose a valid range before minting.',
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: MINT_RANGE_ACTION,
          builder: 'buildMintRangeTx',
          field: 'quantityQuote',
        },
        message: 'Mint range quantity must be greater than zero.',
        recovery: 'Enter a positive quantity before building the range mint transaction.',
      }),
      ok: false,
    };
  }

  return {
    managerId,
    ok: true,
    quantityQuote,
    rangeKey: rangeKeyValidation.rangeKey,
    sender,
  };
}

function createRangeAffectedObjects(managerId: ObjectId, oracleId: ObjectId): AffectedObjectHint[] {
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

function hasConnectedSender(sender: BuildMintRangeTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function hasPositiveQuoteAmount(
  quantityQuote: BuildMintRangeTxOptions['quantityQuote'],
): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}

function validateRangeKey(
  rangeKey: BuildMintRangeTxOptions['rangeKey'],
):
  | {
      ok: true;
      rangeKey: RangeKeyModel;
    }
  | {
      code: 'INVALID_INPUT' | 'INVALID_RANGE';
      field: keyof RangeKeyModel | 'rangeKey';
      message: string;
      ok: false;
    } {
  if (rangeKey === null || rangeKey === undefined) {
    return {
      code: 'INVALID_INPUT',
      field: 'rangeKey',
      message: 'A range key is required.',
      ok: false,
    };
  }

  if (!hasValidObjectId(rangeKey.oracleId)) {
    return {
      code: 'INVALID_INPUT',
      field: 'oracleId',
      message: 'A valid OracleSVI object ID is required.',
      ok: false,
    };
  }

  if (!isNonNegativeBigint(rangeKey.expiryMs)) {
    return {
      code: 'INVALID_INPUT',
      field: 'expiryMs',
      message: 'Range expiry must be a non-negative integer timestamp.',
      ok: false,
    };
  }

  if (!isNonNegativeBigint(rangeKey.lowerStrike1e9)) {
    return {
      code: 'INVALID_INPUT',
      field: 'lowerStrike1e9',
      message: 'Range lower strike must be a non-negative integer price.',
      ok: false,
    };
  }

  if (!isNonNegativeBigint(rangeKey.higherStrike1e9)) {
    return {
      code: 'INVALID_INPUT',
      field: 'higherStrike1e9',
      message: 'Range higher strike must be a non-negative integer price.',
      ok: false,
    };
  }

  if (rangeKey.lowerStrike1e9 >= rangeKey.higherStrike1e9) {
    return {
      code: 'INVALID_RANGE',
      field: 'lowerStrike1e9',
      message: 'Range lower strike must be below the higher strike.',
      ok: false,
    };
  }

  return {
    ok: true,
    rangeKey,
  };
}

function isNonNegativeBigint(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n;
}
