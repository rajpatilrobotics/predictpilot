import type { ObjectId, Price1e9, SuiAddress, TimestampMs } from './predict';

export type OracleLifecycleStatus = 'INACTIVE' | 'ACTIVE' | 'PENDING_SETTLEMENT' | 'SETTLED';

export type OracleFreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

export interface OracleSviParametersModel {
  a1e9: Price1e9;
  b1e9: Price1e9;
  rho1e9Signed: bigint;
  m1e9Signed: bigint;
  sigma1e9: Price1e9;
}

export interface OraclePriceModel {
  spot1e9: Price1e9;
  forward1e9: Price1e9;
  settlementPrice1e9: Price1e9 | null;
  updatedAtMs: TimestampMs;
}

export interface OracleFreshnessModel {
  status: OracleFreshnessStatus;
  lastServerRefreshMs: TimestampMs | null;
  lastOracleUpdateMs: TimestampMs | null;
  staleAfterMs: TimestampMs | null;
}

export interface OracleSVIModel {
  oracleId: ObjectId;
  underlyingAsset: string;
  expiryMs: TimestampMs;
  lifecycleStatus: OracleLifecycleStatus;
  price: OraclePriceModel;
  svi: OracleSviParametersModel;
  freshness: OracleFreshnessModel;
}

export interface OracleSummaryModel {
  predictId: ObjectId;
  oracleId: ObjectId;
  oracleCapId: ObjectId;
  underlyingAsset: string;
  expiryMs: TimestampMs;
  minStrike1e9: Price1e9;
  tickSize1e9: Price1e9;
  lifecycleStatus: OracleLifecycleStatus;
  activatedAtMs: TimestampMs | null;
  settlementPrice1e9: Price1e9 | null;
  settledAtMs: TimestampMs | null;
  createdCheckpoint: bigint;
}

export interface OracleIndexedPriceModel {
  eventDigest: string;
  digest: string;
  sender: SuiAddress;
  checkpoint: bigint;
  checkpointTimestampMs: TimestampMs;
  txIndex: number;
  eventIndex: number;
  packageId: ObjectId;
  oracleId: ObjectId;
  spot1e9: Price1e9;
  forward1e9: Price1e9;
  onchainTimestampMs: TimestampMs;
}

export interface OracleIndexedSviModel {
  eventDigest: string;
  digest: string;
  sender: SuiAddress;
  checkpoint: bigint;
  checkpointTimestampMs: TimestampMs;
  txIndex: number;
  eventIndex: number;
  packageId: ObjectId;
  oracleId: ObjectId;
  svi: OracleSviParametersModel;
  onchainTimestampMs: TimestampMs;
}

export type OracleAskBoundsModel =
  | {
      status: 'UNAVAILABLE';
    }
  | {
      status: 'PRESENT_UNMAPPED';
    };

export interface OracleStateModel {
  oracle: OracleSummaryModel;
  latestPrice: OracleIndexedPriceModel | null;
  latestSvi: OracleIndexedSviModel | null;
  askBounds: OracleAskBoundsModel;
}

export interface OraclePriceHistoryPoint {
  oracleId: ObjectId;
  timestampMs: TimestampMs;
  spot1e9: Price1e9;
  forward1e9: Price1e9;
}

export interface OracleSviHistoryPoint {
  oracleId: ObjectId;
  timestampMs: TimestampMs;
  svi: OracleSviParametersModel;
}

export interface OracleLifecycleHistoryPoint {
  oracleId: ObjectId;
  timestampMs: TimestampMs;
  status: OracleLifecycleStatus;
  settlementPrice1e9?: Price1e9;
}
