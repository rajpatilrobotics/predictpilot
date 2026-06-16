import type {
  BinaryDirection,
  MarketKeyModel,
  MoveType,
  ObjectId,
  Price1e9,
  QuoteAmount,
  RangeKeyModel,
  SuiAddress,
  TimestampMs,
  TransactionDigest,
} from './predict';

export interface PnlPointModel {
  timestampMs: TimestampMs;
  pnlQuote: QuoteAmount;
  realizedPnlQuote?: QuoteAmount;
  cumulativeRealizedPnlQuote?: QuoteAmount;
  unrealizedPnlQuote?: QuoteAmount;
  totalPnlQuote?: QuoteAmount;
  equityQuote?: QuoteAmount;
}

interface ProtocolHistoryRecordBase {
  digest: TransactionDigest;
  timestampMs: TimestampMs;
  eventDigest?: string;
  sender?: SuiAddress;
  checkpoint?: bigint;
  packageId?: ObjectId;
  txIndex?: number;
  eventIndex?: number;
}

export interface BinaryMintHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'BINARY_MINT';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAssetType: MoveType;
  key: MarketKeyModel;
  quantityQuote: QuoteAmount;
  costQuote: QuoteAmount;
  askPrice1e9?: Price1e9;
}

export interface BinaryRedeemHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'BINARY_REDEEM';
  predictId: ObjectId;
  managerId: ObjectId;
  owner: SuiAddress;
  executor: SuiAddress;
  quoteAssetType: MoveType;
  key: MarketKeyModel;
  quantityQuote: QuoteAmount;
  payoutQuote: QuoteAmount;
  bidPrice1e9?: Price1e9;
  isSettled: boolean;
}

export interface RangeMintHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'RANGE_MINT';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAssetType: MoveType;
  key: RangeKeyModel;
  quantityQuote: QuoteAmount;
  costQuote: QuoteAmount;
  askPrice1e9?: Price1e9;
}

export interface RangeRedeemHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'RANGE_REDEEM';
  predictId: ObjectId;
  managerId: ObjectId;
  trader: SuiAddress;
  quoteAssetType: MoveType;
  key: RangeKeyModel;
  quantityQuote: QuoteAmount;
  payoutQuote: QuoteAmount;
  bidPrice1e9?: Price1e9;
  isSettled: boolean;
}

export interface LpSupplyHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'LP_SUPPLY';
  predictId: ObjectId;
  provider: SuiAddress;
  quoteAssetType: MoveType;
  suppliedQuote: QuoteAmount;
  mintedPlpAtomic: bigint;
}

export interface LpWithdrawHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'LP_WITHDRAW';
  predictId: ObjectId;
  provider: SuiAddress;
  quoteAssetType: MoveType;
  burnedPlpAtomic: bigint;
  withdrawnQuote: QuoteAmount;
}

export interface OracleTradeHistoryRecord extends ProtocolHistoryRecordBase {
  kind: 'ORACLE_TRADE';
  oracleId: ObjectId;
  trader?: SuiAddress;
  direction?: BinaryDirection;
  marketKey?: MarketKeyModel;
  rangeKey?: RangeKeyModel;
  quantityQuote?: QuoteAmount;
  costQuote?: QuoteAmount;
  payoutQuote?: QuoteAmount;
}

export type ProtocolHistoryRecord =
  | BinaryMintHistoryRecord
  | BinaryRedeemHistoryRecord
  | RangeMintHistoryRecord
  | RangeRedeemHistoryRecord
  | LpSupplyHistoryRecord
  | LpWithdrawHistoryRecord
  | OracleTradeHistoryRecord;
