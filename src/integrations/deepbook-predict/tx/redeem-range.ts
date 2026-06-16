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

export interface BuildRedeemRangeTxOptions {
  managerId?: ObjectId | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
  sender?: SuiAddress | null;
}

export interface RedeemRangeTxPreview {
  action: Extract<PredictTransactionAction, 'REDEEM_RANGE'>;
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
  target: typeof predictTxTargets.predict.redeemRange;
  title: string;
}

export type BuildRedeemRangeTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: RedeemRangeTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedRedeemRangeInputs =
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

const REDEEM_RANGE_ACTION = 'REDEEM_RANGE' satisfies PredictTransactionAction;
const REDEEM_RANGE_DESCRIPTION =
  'Redeem a range position back into the selected PredictManager balance.';

export function buildRedeemRangeTx({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildRedeemRangeTxOptions = {}): BuildRedeemRangeTxResult {
  const validation = validateRedeemRangeInputs({ managerId, quantityQuote, rangeKey, sender });

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
      target: predictTxTargets.predict.redeemRange,
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
    const preview: RedeemRangeTxPreview = {
      action: REDEEM_RANGE_ACTION,
      affectedObjects,
      description: REDEEM_RANGE_DESCRIPTION,
      expectedNetwork: predictDeploymentConfig.network,
      managerId: validation.managerId,
      oracleId: validation.rangeKey.oracleId,
      postTransactionRefreshKeys,
      quantityQuote: validation.quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: validation.rangeKey,
      sender: validation.sender,
      target: predictTxTargets.predict.redeemRange,
      title: 'Redeem range position',
    };

    return {
      executionRequest: {
        action: REDEEM_RANGE_ACTION,
        affectedObjects,
        description: REDEEM_RANGE_DESCRIPTION,
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
          action: REDEEM_RANGE_ACTION,
          builder: 'buildRedeemRangeTx',
          errorName: error instanceof Error ? error.name : typeof error,
          managerId: validation.managerId,
          oracleId: validation.rangeKey.oracleId,
        },
      }),
      ok: false,
    };
  }
}

function validateRedeemRangeInputs({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildRedeemRangeTxOptions): ValidatedRedeemRangeInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: REDEEM_RANGE_ACTION,
          builder: 'buildRedeemRangeTx',
        },
      }),
      ok: false,
    };
  }

  if (!hasValidObjectId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: REDEEM_RANGE_ACTION,
          builder: 'buildRedeemRangeTx',
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: 'Select or create a PredictManager before redeeming a range position.',
      }),
      ok: false,
    };
  }

  const rangeKeyValidation = validateRangeKey(rangeKey);
  if (!rangeKeyValidation.ok) {
    return {
      error: createAppError(rangeKeyValidation.code, {
        context: {
          action: REDEEM_RANGE_ACTION,
          builder: 'buildRedeemRangeTx',
          field: rangeKeyValidation.field,
        },
        message: rangeKeyValidation.message,
        recovery: 'Refresh oracle state and choose a valid range before redeeming.',
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: REDEEM_RANGE_ACTION,
          builder: 'buildRedeemRangeTx',
          field: 'quantityQuote',
        },
        message: 'Redeem range quantity must be greater than zero.',
        recovery: 'Enter a positive quantity before building the range redeem transaction.',
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

function hasConnectedSender(sender: BuildRedeemRangeTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function hasPositiveQuoteAmount(
  quantityQuote: BuildRedeemRangeTxOptions['quantityQuote'],
): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}

function validateRangeKey(
  rangeKey: BuildRedeemRangeTxOptions['rangeKey'],
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
