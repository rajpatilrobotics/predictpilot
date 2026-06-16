import { runtimeConfig } from '@/config/env';
import type { MoveType, ObjectId, PredictNetwork, PredictSourceBranch } from '@/types/predict';

export const PREDICT_SOURCE_BRANCH = 'predict-testnet-4-16' satisfies PredictSourceBranch;
export const PREDICT_VERIFIED_RANGE = 'ALL';

export interface PredictQuoteAssetConfig {
  currencyId: ObjectId;
  decimals: number;
  symbol: 'DUSDC';
  type: MoveType;
}

export interface PredictDeploymentConfig {
  defaultMarketId?: ObjectId;
  defaultOracleId?: ObjectId;
  network: PredictNetwork;
  packageId: ObjectId;
  plpType: MoveType;
  predictObjectId: ObjectId;
  quoteAsset: PredictQuoteAssetConfig;
  quoteAssetType: MoveType;
  quoteCurrencyId: ObjectId;
  quoteDecimals: number;
  registryId: ObjectId;
  serverBaseUrl: string;
  sourceBranch: PredictSourceBranch;
}

// Current DeepBook Predict values are the public Testnet deployment pinned to
// predict-testnet-4-16. Treat them as provisional until official Mainnet docs
// replace the environment values.
export const predictDeploymentConfig = {
  defaultMarketId: runtimeConfig.defaultMarketId as ObjectId | undefined,
  defaultOracleId: runtimeConfig.defaultOracleId as ObjectId | undefined,
  network: runtimeConfig.suiNetwork,
  packageId: runtimeConfig.predictPackageId as ObjectId,
  plpType: runtimeConfig.plpType as MoveType,
  predictObjectId: runtimeConfig.predictObjectId as ObjectId,
  quoteAsset: {
    currencyId: runtimeConfig.predictQuoteCurrencyId as ObjectId,
    decimals: runtimeConfig.predictQuoteDecimals,
    symbol: 'DUSDC',
    type: runtimeConfig.predictQuoteType as MoveType,
  },
  quoteAssetType: runtimeConfig.predictQuoteType as MoveType,
  quoteCurrencyId: runtimeConfig.predictQuoteCurrencyId as ObjectId,
  quoteDecimals: runtimeConfig.predictQuoteDecimals,
  registryId: runtimeConfig.predictRegistryId as ObjectId,
  serverBaseUrl: runtimeConfig.predictServerUrl,
  sourceBranch: PREDICT_SOURCE_BRANCH,
} as const satisfies PredictDeploymentConfig;

export const predictServerEndpoints = {
  historyLpSupplies: () => '/lp/supplies',
  historyLpWithdrawals: () => '/lp/withdrawals',
  historyPositionsMinted: () => '/positions/minted',
  historyPositionsRedeemed: () => '/positions/redeemed',
  historyRangesMinted: () => '/ranges/minted',
  historyRangesRedeemed: () => '/ranges/redeemed',
  managerPnl: (managerId: ObjectId) => `/managers/${managerId}/pnl`,
  managerPositionsSummary: (managerId: ObjectId) => `/managers/${managerId}/positions/summary`,
  managerSummary: (managerId: ObjectId) => `/managers/${managerId}/summary`,
  managers: () => '/managers',
  oracleAskBounds: (oracleId: ObjectId) => `/oracles/${oracleId}/ask-bounds`,
  oracleLatestPrice: (oracleId: ObjectId) => `/oracles/${oracleId}/prices/latest`,
  oracleLatestSvi: (oracleId: ObjectId) => `/oracles/${oracleId}/svi/latest`,
  oraclePrices: (oracleId: ObjectId) => `/oracles/${oracleId}/prices`,
  oracleState: (oracleId: ObjectId) => `/oracles/${oracleId}/state`,
  oracleSvi: (oracleId: ObjectId) => `/oracles/${oracleId}/svi`,
  oracleTrades: (oracleId: ObjectId) => `/trades/${oracleId}`,
  predictOracles: (predictId: ObjectId = predictDeploymentConfig.predictObjectId) =>
    `/predicts/${predictId}/oracles`,
  predictQuoteAssets: (predictId: ObjectId = predictDeploymentConfig.predictObjectId) =>
    `/predicts/${predictId}/quote-assets`,
  predictState: (predictId: ObjectId = predictDeploymentConfig.predictObjectId) =>
    `/predicts/${predictId}/state`,
  status: () => '/status',
  vaultPerformance: (predictId: ObjectId = predictDeploymentConfig.predictObjectId) =>
    `/predicts/${predictId}/vault/performance`,
  vaultSummary: (predictId: ObjectId = predictDeploymentConfig.predictObjectId) =>
    `/predicts/${predictId}/vault/summary`,
} as const;

export function predictVerifiedRangeQuery(
  range: typeof PREDICT_VERIFIED_RANGE = PREDICT_VERIFIED_RANGE,
) {
  return { range };
}
