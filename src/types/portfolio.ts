import type { PnlPointModel } from './history';
import type {
  MarketKeyModel,
  MoveType,
  ObjectId,
  QuoteAmount,
  RangeKeyModel,
  SuiAddress,
  TimestampMs,
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
