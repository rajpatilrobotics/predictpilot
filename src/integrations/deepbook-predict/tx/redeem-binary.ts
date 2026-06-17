import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import type { PredictPilotError } from '@/lib/errors';
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
import { predictTxTargets } from '../targets';
import {
  addPredictManagerTradeCall,
  buildBinaryMarketKey,
  createPredictExecutionRequest,
  createPredictManagerOracleAffectedObjects,
  createPtbBuildError,
  validateBinaryTradeInputs,
} from './builder-shared';

export interface BuildRedeemBinaryTxOptions {
  managerId?: ObjectId | null;
  marketKey?: MarketKeyModel | null;
  quantityQuote?: QuoteAmount | null;
  sender?: SuiAddress | null;
}

export interface RedeemBinaryTxPreview {
  action: Extract<PredictTransactionAction, 'REDEEM'>;
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
  target: typeof predictTxTargets.predict.redeem;
  title: string;
}

export type BuildRedeemBinaryTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: RedeemBinaryTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const REDEEM_BINARY_ACTION = 'REDEEM' satisfies PredictTransactionAction;
const REDEEM_BINARY_BUILDER = 'buildRedeemBinaryTx';
const REDEEM_BINARY_DESCRIPTION =
  'Redeem a binary position back into the selected PredictManager balance.';

export function buildRedeemBinaryTx({
  managerId,
  marketKey,
  quantityQuote,
  sender,
}: BuildRedeemBinaryTxOptions = {}): BuildRedeemBinaryTxResult {
  const validation = validateBinaryTradeInputs({
    action: REDEEM_BINARY_ACTION,
    builder: REDEEM_BINARY_BUILDER,
    copy: {
      invalidKeyRecovery: 'Refresh oracle state and choose a valid binary market before redeeming.',
      invalidManagerRecovery:
        'Select or create a PredictManager before redeeming a binary position.',
      invalidQuantityMessage: 'Redeem quantity must be greater than zero.',
      invalidQuantityRecovery:
        'Enter a positive quantity before building the binary redeem transaction.',
    },
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
    const binaryMarketKey = buildBinaryMarketKey(transaction, validation.marketKey);

    addPredictManagerTradeCall({
      managerId: validation.managerId,
      oracleId: validation.marketKey.oracleId,
      positionKey: binaryMarketKey,
      quantityQuote: validation.quantityQuote,
      target: predictTxTargets.predict.redeem,
      transaction,
    });

    const affectedObjects = createPredictManagerOracleAffectedObjects(
      validation.managerId,
      validation.marketKey.oracleId,
    );
    const preview = createRedeemBinaryPreview(validation, affectedObjects);

    return {
      executionRequest: createPredictExecutionRequest({
        action: REDEEM_BINARY_ACTION,
        affectedObjects,
        description: REDEEM_BINARY_DESCRIPTION,
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
        action: REDEEM_BINARY_ACTION,
        builder: REDEEM_BINARY_BUILDER,
        error,
        managerId: validation.managerId,
        oracleId: validation.marketKey.oracleId,
      }),
      ok: false,
    };
  }
}

function createRedeemBinaryPreview(
  validation: Extract<ReturnType<typeof validateBinaryTradeInputs>, { ok: true }>,
  affectedObjects: AffectedObjectHint[],
): RedeemBinaryTxPreview {
  return {
    action: REDEEM_BINARY_ACTION,
    affectedObjects,
    description: REDEEM_BINARY_DESCRIPTION,
    direction: validation.marketKey.direction,
    expectedNetwork: predictDeploymentConfig.network,
    managerId: validation.managerId,
    marketKey: validation.marketKey,
    oracleId: validation.marketKey.oracleId,
    postTransactionRefreshKeys: predictInvalidationKeys.afterManagerWrite({
      managerId: validation.managerId,
      oracleId: validation.marketKey.oracleId,
    }),
    quantityQuote: validation.quantityQuote,
    quoteAsset: predictDeploymentConfig.quoteAsset,
    sender: validation.sender,
    target: predictTxTargets.predict.redeem,
    title: 'Redeem binary position',
  };
}
