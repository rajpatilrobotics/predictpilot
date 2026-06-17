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

const MINT_RANGE_ACTION = 'MINT_RANGE' satisfies PredictTransactionAction;
const MINT_RANGE_BUILDER = 'buildMintRangeTx';
const MINT_RANGE_DESCRIPTION = 'Mint a range position from the selected PredictManager balance.';

export function buildMintRangeTx({
  managerId,
  quantityQuote,
  rangeKey,
  sender,
}: BuildMintRangeTxOptions = {}): BuildMintRangeTxResult {
  const validation = validateRangeTradeInputs({
    action: MINT_RANGE_ACTION,
    builder: MINT_RANGE_BUILDER,
    copy: {
      invalidKeyRecovery: 'Refresh oracle state and choose a valid range before minting.',
      invalidManagerRecovery: 'Select or create a PredictManager before minting a range position.',
      invalidQuantityMessage: 'Mint range quantity must be greater than zero.',
      invalidQuantityRecovery:
        'Enter a positive quantity before building the range mint transaction.',
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
      target: predictTxTargets.predict.mintRange,
      transaction,
    });

    const affectedObjects = createPredictManagerOracleAffectedObjects(
      validation.managerId,
      validation.rangeKey.oracleId,
    );
    const preview = createMintRangePreview(validation, affectedObjects);

    return {
      executionRequest: createPredictExecutionRequest({
        action: MINT_RANGE_ACTION,
        affectedObjects,
        description: MINT_RANGE_DESCRIPTION,
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
        action: MINT_RANGE_ACTION,
        builder: MINT_RANGE_BUILDER,
        error,
        managerId: validation.managerId,
        oracleId: validation.rangeKey.oracleId,
      }),
      ok: false,
    };
  }
}

function createMintRangePreview(
  validation: Extract<ReturnType<typeof validateRangeTradeInputs>, { ok: true }>,
  affectedObjects: AffectedObjectHint[],
): MintRangeTxPreview {
  return {
    action: MINT_RANGE_ACTION,
    affectedObjects,
    description: MINT_RANGE_DESCRIPTION,
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
    target: predictTxTargets.predict.mintRange,
    title: 'Mint range position',
  };
}
