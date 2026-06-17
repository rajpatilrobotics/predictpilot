import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import type { PredictPilotError } from '@/lib/errors';
import { predictInvalidationKeys } from '@/lib/query-keys';
import type { QueryKey } from '@tanstack/react-query';
import type { ObjectId, QuoteAmount, RangeKeyModel, SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictTxTargets } from '../targets';
import {
  addPredictManagerTradeCall,
  buildRangeKey,
  createPredictExecutionRequest,
  createPredictManagerOracleAffectedObjects,
  createPtbBuildError,
  validateRangeTradeInputs,
} from './builder-shared';

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

const REDEEM_RANGE_ACTION = 'REDEEM_RANGE' satisfies PredictTransactionAction;
const REDEEM_RANGE_BUILDER = 'buildRedeemRangeTx';
const REDEEM_RANGE_DESCRIPTION =
  'Redeem a range position back into the selected PredictManager balance.';

export function buildRedeemRangeTx({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildRedeemRangeTxOptions = {}): BuildRedeemRangeTxResult {
  const validation = validateRangeTradeInputs({
    action: REDEEM_RANGE_ACTION,
    builder: REDEEM_RANGE_BUILDER,
    copy: {
      invalidKeyRecovery: 'Refresh oracle state and choose a valid range before redeeming.',
      invalidManagerRecovery:
        'Select or create a PredictManager before redeeming a range position.',
      invalidQuantityMessage: 'Redeem range quantity must be greater than zero.',
      invalidQuantityRecovery:
        'Enter a positive quantity before building the range redeem transaction.',
    },
    managerId,
    quantityQuote,
    rangeKey,
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
    const verticalRangeKey = buildRangeKey(transaction, validation.rangeKey);

    addPredictManagerTradeCall({
      managerId: validation.managerId,
      oracleId: validation.rangeKey.oracleId,
      positionKey: verticalRangeKey,
      quantityQuote: validation.quantityQuote,
      target: predictTxTargets.predict.redeemRange,
      transaction,
    });

    const affectedObjects = createPredictManagerOracleAffectedObjects(
      validation.managerId,
      validation.rangeKey.oracleId,
    );
    const preview = createRedeemRangePreview(validation, affectedObjects);

    return {
      executionRequest: createPredictExecutionRequest({
        action: REDEEM_RANGE_ACTION,
        affectedObjects,
        description: REDEEM_RANGE_DESCRIPTION,
        sender: validation.sender,
        transaction,
      }),
      ok: true,
      preview,
      transaction,
    };
  } catch (error) {
    return {
      error: createPtbBuildError({
        action: REDEEM_RANGE_ACTION,
        builder: REDEEM_RANGE_BUILDER,
        error,
        managerId: validation.managerId,
        oracleId: validation.rangeKey.oracleId,
      }),
      ok: false,
    };
  }
}

function createRedeemRangePreview(
  validation: Extract<ReturnType<typeof validateRangeTradeInputs>, { ok: true }>,
  affectedObjects: AffectedObjectHint[],
): RedeemRangeTxPreview {
  return {
    action: REDEEM_RANGE_ACTION,
    affectedObjects,
    description: REDEEM_RANGE_DESCRIPTION,
    expectedNetwork: predictDeploymentConfig.network,
    managerId: validation.managerId,
    oracleId: validation.rangeKey.oracleId,
    postTransactionRefreshKeys: predictInvalidationKeys.afterManagerWrite({
      managerId: validation.managerId,
      oracleId: validation.rangeKey.oracleId,
    }),
    quantityQuote: validation.quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    rangeKey: validation.rangeKey,
    sender: validation.sender,
    target: predictTxTargets.predict.redeemRange,
    title: 'Redeem range position',
  };
}
