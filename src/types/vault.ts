import type { MoveType, ObjectId, QuoteAmount, TimestampMs } from './predict';

export interface VaultModel {
  predictId: ObjectId;
  quoteAssetType: MoveType;
  quoteAssetTypes: MoveType[];
  vaultBalanceQuote: QuoteAmount;
  assetBalanceQuote: QuoteAmount;
  totalMtmQuote: QuoteAmount;
  vaultValueQuote: QuoteAmount;
  totalMaxPayoutQuote: QuoteAmount;
  availableLiquidityQuote: QuoteAmount;
  availableWithdrawalQuote: QuoteAmount;
  plpTotalSupplyAtomic: bigint;
  plpSharePrice: number;
  utilizationRatio: number;
  maxPayoutUtilizationRatio: number;
  netDepositsQuote: QuoteAmount;
  totalSuppliedQuote: QuoteAmount;
  totalWithdrawnQuote: QuoteAmount;
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
  sharePrice: number;
  totalSharesAtomic: bigint;
  totalMtmQuote?: QuoteAmount;
  totalMaxPayoutQuote?: QuoteAmount;
}

export interface VaultPerformanceModel {
  predictId: ObjectId;
  range: 'ALL';
  points: VaultPerformancePoint[];
}

export interface LpPositionModel {
  predictId: ObjectId;
  plp: PlpModel;
  suppliedQuote: QuoteAmount;
  withdrawnQuote: QuoteAmount;
  netSuppliedQuote: QuoteAmount;
}
