export type ObjectId = `0x${string}`;
export type SuiAddress = `0x${string}`;
export type MoveType = `${ObjectId}::${string}::${string}`;
export type TransactionDigest = string;

export type QuoteAmount = bigint;
export type Price1e9 = bigint;
export type TimestampMs = bigint;

export type PredictNetwork = 'testnet';
export type PredictSourceBranch = 'predict-testnet-4-16';
export type ServerValueStatus = 'PRESENT' | 'MISSING';

export type BinaryDirection = 'UP' | 'DOWN';
export type BinaryPositionAction = 'MINT' | 'REDEEM';
export type RangePositionAction = 'MINT_RANGE' | 'REDEEM_RANGE';
export type VaultAction = 'SUPPLY' | 'WITHDRAW';
export type ManagerAction = 'CREATE_MANAGER' | 'DEPOSIT_QUOTE' | 'WITHDRAW_QUOTE';

export interface PredictDeploymentModel {
  network: PredictNetwork;
  serverBaseUrl: string;
  packageId: ObjectId;
  registryId: ObjectId;
  predictObjectId: ObjectId;
  quoteAssetType: MoveType;
  quoteCurrencyId: ObjectId;
  quoteDecimals: number;
  plpType: MoveType;
  sourceBranch: PredictSourceBranch;
  defaultOracleId?: ObjectId;
  defaultMarketId?: ObjectId;
}

export interface PredictStateModel {
  predictId: ObjectId;
  quoteAssets: MoveType[];
  tradingPaused: boolean | null;
  pricingStatus: ServerValueStatus;
  riskStatus: ServerValueStatus;
}

export interface MarketKeyModel {
  oracleId: ObjectId;
  expiryMs: TimestampMs;
  strike1e9: Price1e9;
  direction: BinaryDirection;
}

export interface RangeKeyModel {
  oracleId: ObjectId;
  expiryMs: TimestampMs;
  lowerStrike1e9: Price1e9;
  higherStrike1e9: Price1e9;
}

export type PredictUserAction =
  | BinaryPositionAction
  | RangePositionAction
  | VaultAction
  | ManagerAction;
