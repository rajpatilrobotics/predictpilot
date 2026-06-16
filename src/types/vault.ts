import type { MoveType, ObjectId, QuoteAmount, TimestampMs } from './predict';

export interface VaultModel {
  predictId: ObjectId;
  quoteAssetType: MoveType;
  vaultBalanceQuote: QuoteAmount;
  assetBalanceQuote: QuoteAmount;
  totalMtmQuote: QuoteAmount;
  vaultValueQuote: QuoteAmount;
  totalMaxPayoutQuote: QuoteAmount;
  totalLiabilityQuote?: QuoteAmount;
  lastRefreshedAtMs: TimestampMs | null;
}

export interface PlpModel {
  coinType: MoveType;
  walletBalanceAtomic: bigint;
  walletBalanceQuote?: QuoteAmount;
  impliedVaultShareRatio?: number;
  lastRefreshedAtMs: TimestampMs | null;
}

export interface VaultPerformancePoint {
  timestampMs: TimestampMs;
  vaultValueQuote: QuoteAmount;
  totalMtmQuote: QuoteAmount;
  totalMaxPayoutQuote: QuoteAmount;
}

export interface LpPositionModel {
  predictId: ObjectId;
  plp: PlpModel;
  suppliedQuote: QuoteAmount;
  withdrawnQuote: QuoteAmount;
  netSuppliedQuote: QuoteAmount;
}
