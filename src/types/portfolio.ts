import type { PnlPointModel } from './history';
import type {
  MarketKeyModel,
  MoveType,
  ObjectId,
  QuoteAmount,
  RangeKeyModel,
  SuiAddress,
  TimestampMs,
  TransactionDigest,
} from './predict';
import type { PlpModel } from './vault';

export interface BinaryPositionModel {
  key: MarketKeyModel;
  quantityQuote: QuoteAmount;
  averageEntryQuote?: QuoteAmount;
  unrealizedPnlQuote?: QuoteAmount;
}

export interface RangePositionModel {
  key: RangeKeyModel;
  quantityQuote: QuoteAmount;
  averageEntryQuote?: QuoteAmount;
  unrealizedPnlQuote?: QuoteAmount;
}

export interface PredictManagerModel {
  managerId: ObjectId;
  owner: SuiAddress;
  quoteAssetType: MoveType;
  availableDusdcQuote: QuoteAmount;
  binaryPositions: BinaryPositionModel[];
  rangePositions: RangePositionModel[];
  lastRefreshedAtMs: TimestampMs | null;
}

export interface PredictManagerCreatedModel {
  managerId: ObjectId;
  owner: SuiAddress;
  sender: SuiAddress;
  digest: TransactionDigest;
  eventDigest: string;
  checkpoint: bigint;
  checkpointTimestampMs: TimestampMs;
  txIndex: number;
  eventIndex: number;
  packageId: ObjectId;
}

export interface ManagerQuoteBalanceModel {
  quoteAssetType: MoveType;
  balanceQuote: QuoteAmount;
}

export interface ManagerSummaryModel {
  managerId: ObjectId;
  owner: SuiAddress;
  balances: ManagerQuoteBalanceModel[];
  tradingBalanceQuote: QuoteAmount;
  openExposureQuote: QuoteAmount;
  redeemableValueQuote: QuoteAmount;
  realizedPnlQuote: QuoteAmount;
  unrealizedPnlQuote: QuoteAmount;
  accountValueQuote: QuoteAmount;
  openPositions: number;
  awaitingSettlementPositions: number;
  lastRefreshedAtMs: TimestampMs | null;
}

export interface BinaryPositionSummaryModel extends BinaryPositionModel {
  predictId: ObjectId;
  managerId: ObjectId;
  quoteAssetType: MoveType;
  underlyingAsset: string;
  mintedQuantityQuote: QuoteAmount;
  redeemedQuantityQuote: QuoteAmount;
  openQuantityQuote: QuoteAmount;
  totalCostQuote: QuoteAmount;
  totalPayoutQuote: QuoteAmount;
  realizedPnlQuote: QuoteAmount;
  openCostBasisQuote: QuoteAmount;
  averageEntryPrice1e9?: bigint;
  averageExitPrice1e9?: bigint;
  markPrice1e9?: bigint;
  markValueQuote?: QuoteAmount;
  status: string;
  firstMintedAtMs: TimestampMs;
  lastActivityAtMs: TimestampMs;
}

export interface ManagerPositionsSummaryModel {
  managerId: ObjectId;
  binaryPositions: BinaryPositionSummaryModel[];
  rangePositions: RangePositionModel[];
}

export interface ManagerPnlModel {
  managerId: ObjectId;
  range: 'ALL';
  seriesType: string | null;
  currentTotalPnlQuote: QuoteAmount;
  currentUnrealizedPnlQuote: QuoteAmount;
  points: PnlPointModel[];
}

export interface WalletQuoteBalanceModel {
  owner: SuiAddress;
  quoteAssetType: MoveType;
  balanceQuote: QuoteAmount;
  lastRefreshedAtMs: TimestampMs | null;
}

export interface PortfolioModel {
  owner: SuiAddress;
  manager: PredictManagerModel | null;
  walletDusdc: WalletQuoteBalanceModel;
  plp: PlpModel | null;
  pnlSeries: PnlPointModel[];
}
