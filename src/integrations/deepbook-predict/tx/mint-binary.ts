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

const MINT_BINARY_ACTION = 'MINT' satisfies PredictTransactionAction;
const MINT_BINARY_BUILDER = 'buildMintBinaryTx';
const MINT_BINARY_DESCRIPTION = 'Mint a binary position from the selected PredictManager balance.';

export function buildMintBinaryTx({
  managerId,
  marketKey,
  quantityQuote,
  sender,
}: BuildMintBinaryTxOptions = {}): BuildMintBinaryTxResult {
  const validation = validateBinaryTradeInputs({
    action: MINT_BINARY_ACTION,
    builder: MINT_BINARY_BUILDER,
    copy: {
      invalidKeyRecovery: 'Refresh oracle state and choose a valid binary market before minting.',
      invalidManagerRecovery: 'Select or create a PredictManager before minting a binary position.',
      invalidQuantityMessage: 'Mint quantity must be greater than zero.',
      invalidQuantityRecovery:
        'Enter a positive quantity before building the binary mint transaction.',
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
      target: predictTxTargets.predict.mint,
      transaction,
    });

    const affectedObjects = createPredictManagerOracleAffectedObjects(
      validation.managerId,
      validation.marketKey.oracleId,
    );
    const preview = createMintBinaryPreview(validation, affectedObjects);

    return {
      executionRequest: createPredictExecutionRequest({
        action: MINT_BINARY_ACTION,
        affectedObjects,
        description: MINT_BINARY_DESCRIPTION,
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
        action: MINT_BINARY_ACTION,
        builder: MINT_BINARY_BUILDER,
        error,
        managerId: validation.managerId,
        oracleId: validation.marketKey.oracleId,
      }),
      ok: false,
    };
  }
}

function createMintBinaryPreview(
  validation: Extract<ReturnType<typeof validateBinaryTradeInputs>, { ok: true }>,
  affectedObjects: AffectedObjectHint[],
): MintBinaryTxPreview {
  return {
    action: MINT_BINARY_ACTION,
    affectedObjects,
    description: MINT_BINARY_DESCRIPTION,
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
    target: predictTxTargets.predict.mint,
    title: 'Mint binary position',
  };
}
