import { predictDeploymentConfig } from '@/config/predict';
import type { MoveType, ObjectId, PredictSourceBranch } from '@/types/predict';

export type PredictMoveModule = 'predict' | 'predict_manager' | 'market_key' | 'range_key';

export type PredictMoveTarget<
  TModule extends PredictMoveModule = PredictMoveModule,
  TFunction extends string = string,
> = `${ObjectId}::${TModule}::${TFunction}`;

export type PredictTargetRegistryStrategy = 'manual-registry';
export type PredictCodegenStatus = 'deferred';

export interface PredictTargetRegistryMetadata {
  codegenStatus: PredictCodegenStatus;
  packageId: ObjectId;
  sourceBranch: PredictSourceBranch;
  strategy: PredictTargetRegistryStrategy;
  todoVerify: readonly string[];
}

export interface PredictProtocolTypes {
  plpType: MoveType;
  quoteAssetType: MoveType;
}

function target<TModule extends PredictMoveModule, TFunction extends string>(
  moduleName: TModule,
  functionName: TFunction,
): PredictMoveTarget<TModule, TFunction> {
  return `${predictDeploymentConfig.packageId}::${moduleName}::${functionName}`;
}

export const predictProtocolTypes = {
  plpType: predictDeploymentConfig.plpType,
  quoteAssetType: predictDeploymentConfig.quoteAsset.type,
} as const satisfies PredictProtocolTypes;

export const predictTargetRegistryMetadata = {
  codegenStatus: 'deferred',
  packageId: predictDeploymentConfig.packageId,
  sourceBranch: predictDeploymentConfig.sourceBranch,
  strategy: 'manual-registry',
  todoVerify: [
    'TODO VERIFY: final frontend helper for passing the Sui framework Clock object into Predict PTBs.',
    'TODO VERIFY: final pure ID argument helper for MarketKey and RangeKey construction in the installed Sui SDK.',
    'TODO VERIFY: generated bindings package/version and source workflow before replacing this manual registry.',
  ],
} as const satisfies PredictTargetRegistryMetadata;

export const predictTxTargets = {
  marketKey: {
    down: target('market_key', 'down'),
    new: target('market_key', 'new'),
    up: target('market_key', 'up'),
  },
  predict: {
    askBounds: target('predict', 'ask_bounds'),
    createManager: target('predict', 'create_manager'),
    getRangeTradeAmounts: target('predict', 'get_range_trade_amounts'),
    getTradeAmounts: target('predict', 'get_trade_amounts'),
    mint: target('predict', 'mint'),
    mintRange: target('predict', 'mint_range'),
    redeem: target('predict', 'redeem'),
    redeemPermissionless: target('predict', 'redeem_permissionless'),
    redeemRange: target('predict', 'redeem_range'),
    supply: target('predict', 'supply'),
    withdraw: target('predict', 'withdraw'),
  },
  predictManager: {
    deposit: target('predict_manager', 'deposit'),
    withdraw: target('predict_manager', 'withdraw'),
  },
  rangeKey: {
    new: target('range_key', 'new'),
  },
} as const;

export type PredictTxTargets = typeof predictTxTargets;
