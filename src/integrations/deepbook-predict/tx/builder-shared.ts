import type { Transaction, TransactionResult } from '@mysten/sui/transactions';
import { predictDeploymentConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError, type PredictPilotErrorCode } from '@/lib/errors';
import type {
  BinaryDirection,
  MarketKeyModel,
  ObjectId,
  QuoteAmount,
  RangeKeyModel,
  SuiAddress,
} from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface BaseManagerTradeOptions {
  managerId?: ObjectId | null;
  quantityQuote?: QuoteAmount | null;
  sender?: SuiAddress | null;
}

export interface BuilderCopy {
  invalidManagerRecovery: string;
  invalidKeyRecovery: string;
  invalidQuantityMessage: string;
  invalidQuantityRecovery: string;
}

export type ValidatedBinaryTradeInputs =
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

export type ValidatedRangeTradeInputs =
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

export function validateBinaryTradeInputs({
  action,
  builder,
  copy,
  managerId,
  marketKey,
  quantityQuote,
  sender,
}: BaseManagerTradeOptions & {
  action: PredictTransactionAction;
  builder: string;
  copy: BuilderCopy;
  marketKey?: MarketKeyModel | null;
}): ValidatedBinaryTradeInputs {
  const baseValidation = validateBaseManagerTradeInputs({
    action,
    builder,
    copy,
    managerId,
    quantityQuote,
    sender,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  const marketKeyValidation = validateMarketKey(marketKey);
  if (!marketKeyValidation.ok) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          builder,
          field: marketKeyValidation.field,
        },
        message: marketKeyValidation.message,
        recovery: copy.invalidKeyRecovery,
      }),
      ok: false,
    };
  }

  return {
    ...baseValidation,
    marketKey: marketKeyValidation.marketKey,
  };
}

export function validateRangeTradeInputs({
  action,
  builder,
  copy,
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BaseManagerTradeOptions & {
  action: PredictTransactionAction;
  builder: string;
  copy: BuilderCopy;
  rangeKey?: RangeKeyModel | null;
}): ValidatedRangeTradeInputs {
  const baseValidation = validateBaseManagerTradeInputs({
    action,
    builder,
    copy,
    managerId,
    quantityQuote,
    sender,
  });

  if (!baseValidation.ok) {
    return baseValidation;
  }

  const rangeKeyValidation = validateRangeKey(rangeKey);
  if (!rangeKeyValidation.ok) {
    return {
      error: createAppError(rangeKeyValidation.code, {
        context: {
          action,
          builder,
          field: rangeKeyValidation.field,
        },
        message: rangeKeyValidation.message,
        recovery: copy.invalidKeyRecovery,
      }),
      ok: false,
    };
  }

  return {
    ...baseValidation,
    rangeKey: rangeKeyValidation.rangeKey,
  };
}

export function createPredictManagerOracleAffectedObjects(
  managerId: ObjectId,
  oracleId: ObjectId,
): AffectedObjectHint[] {
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

export function createPredictExecutionRequest({
  action,
  affectedObjects,
  description,
  sender,
  transaction,
}: {
  action: PredictTransactionAction;
  affectedObjects: AffectedObjectHint[];
  description: string;
  sender: SuiAddress;
  transaction: Transaction;
}): PredictTransactionExecutionRequest {
  return {
    action,
    affectedObjects,
    description,
    sender,
    transaction,
  };
}

export function createPtbBuildError({
  action,
  builder,
  error,
  managerId,
  oracleId,
}: {
  action: PredictTransactionAction;
  builder: string;
  error: unknown;
  managerId?: ObjectId;
  oracleId?: ObjectId;
}) {
  return createAppError('PTB_BUILD_FAILED', {
    context: {
      action,
      builder,
      errorName: error instanceof Error ? error.name : typeof error,
      managerId,
      oracleId,
    },
  });
}

export function buildBinaryMarketKey(
  transaction: Transaction,
  marketKey: MarketKeyModel,
): TransactionResult {
  return transaction.moveCall({
    arguments: [
      transaction.pure.id(marketKey.oracleId),
      transaction.pure.u64(marketKey.expiryMs),
      transaction.pure.u64(marketKey.strike1e9),
    ],
    target: getMarketKeyTarget(marketKey.direction),
  });
}

export function buildRangeKey(
  transaction: Transaction,
  rangeKey: RangeKeyModel,
): TransactionResult {
  return transaction.moveCall({
    arguments: [
      transaction.pure.id(rangeKey.oracleId),
      transaction.pure.u64(rangeKey.expiryMs),
      transaction.pure.u64(rangeKey.lowerStrike1e9),
      transaction.pure.u64(rangeKey.higherStrike1e9),
    ],
    target: predictTxTargets.rangeKey.new,
  });
}

export function addPredictManagerTradeCall({
  managerId,
  oracleId,
  positionKey,
  quantityQuote,
  target,
  transaction,
}: {
  managerId: ObjectId;
  oracleId: ObjectId;
  positionKey: TransactionResult;
  quantityQuote: QuoteAmount;
  target:
    | typeof predictTxTargets.predict.mint
    | typeof predictTxTargets.predict.mintRange
    | typeof predictTxTargets.predict.redeem
    | typeof predictTxTargets.predict.redeemRange;
  transaction: Transaction;
}) {
  transaction.moveCall({
    arguments: [
      transaction.object(predictDeploymentConfig.predictObjectId),
      transaction.object(managerId),
      transaction.object(oracleId),
      positionKey,
      transaction.pure.u64(quantityQuote),
      transaction.object.clock(),
    ],
    target,
    typeArguments: [predictProtocolTypes.quoteAssetType],
  });
}

export function getMarketKeyTarget(direction: BinaryDirection) {
  return direction === 'UP' ? predictTxTargets.marketKey.up : predictTxTargets.marketKey.down;
}

function validateBaseManagerTradeInputs({
  action,
  builder,
  copy,
  managerId,
  quantityQuote,
  sender,
}: BaseManagerTradeOptions & {
  action: PredictTransactionAction;
  builder: string;
  copy: BuilderCopy;
}):
  | {
      managerId: ObjectId;
      ok: true;
      quantityQuote: QuoteAmount;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    } {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action,
          builder,
        },
      }),
      ok: false,
    };
  }

  if (!hasValidObjectId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          builder,
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: copy.invalidManagerRecovery,
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(quantityQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          builder,
          field: 'quantityQuote',
        },
        message: copy.invalidQuantityMessage,
        recovery: copy.invalidQuantityRecovery,
      }),
      ok: false,
    };
  }

  return {
    managerId,
    ok: true,
    quantityQuote,
    sender,
  };
}

function validateMarketKey(marketKey: MarketKeyModel | null | undefined):
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

function validateRangeKey(rangeKey: RangeKeyModel | null | undefined):
  | {
      ok: true;
      rangeKey: RangeKeyModel;
    }
  | {
      code: Extract<PredictPilotErrorCode, 'INVALID_INPUT' | 'INVALID_RANGE'>;
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

function hasConnectedSender(sender: SuiAddress | null | undefined): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidObjectId(objectId: ObjectId | null | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function hasPositiveQuoteAmount(
  quantityQuote: QuoteAmount | null | undefined,
): quantityQuote is QuoteAmount {
  return typeof quantityQuote === 'bigint' && quantityQuote > 0n;
}

function isNonNegativeBigint(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n;
}
