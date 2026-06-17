import { createPredictServerClient, type PredictServerClient } from '@/integrations/deepbook-predict/client';
import type {
  ObjectIdDto,
  OracleAskBoundsDto,
  OraclePriceUpdateDto,
  OracleStateDto,
  OracleSummaryDto,
  OracleSviUpdateDto,
} from '@/integrations/deepbook-predict/schemas';
import type {
  OracleAskBoundsModel,
  OracleIndexedPriceModel,
  OracleIndexedSviModel,
  OracleLifecycleStatus,
  OracleStateModel,
  OracleSummaryModel,
  OracleSviParametersModel,
} from '@/types/oracle';
import type { ObjectId, SuiAddress } from '@/types/predict';
import {
  normalizeObjectId,
  PredictAdapterError,
  toBigInt,
  toNullableBigInt,
} from './mapping';

export { PredictAdapterError } from './mapping';

export type OracleReadClient = Pick<PredictServerClient, 'fetchOracleAskBoundsDto' | 'fetchOracleStateDto'>;

export interface GetOracleStateOptions {
  client?: OracleReadClient;
  oracleId: ObjectId;
}

export interface GetAskBoundsOptions {
  client?: OracleReadClient;
  oracleId: ObjectId;
}

export async function getOracleState({
  client = createPredictServerClient(),
  oracleId,
}: GetOracleStateOptions): Promise<OracleStateModel> {
  const dto = await client.fetchOracleStateDto(oracleId);
  return mapOracleStateDtoToModel(dto);
}

export async function getAskBounds({
  client = createPredictServerClient(),
  oracleId,
}: GetAskBoundsOptions): Promise<OracleAskBoundsModel> {
  const dto = await client.fetchOracleAskBoundsDto(oracleId);
  return mapOracleAskBoundsDtoToModel(dto);
}

export function mapOracleStateDtoToModel(dto: OracleStateDto): OracleStateModel {
  return {
    askBounds: mapOracleAskBoundsDtoToModel(dto.ask_bounds),
    latestPrice: dto.latest_price === null ? null : mapOraclePriceUpdateDtoToModel(dto.latest_price),
    latestSvi: dto.latest_svi === null ? null : mapOracleSviUpdateDtoToModel(dto.latest_svi),
    oracle: mapOracleSummaryDtoToModel(dto.oracle),
  };
}

export function mapOracleSummaryDtoToModel(dto: OracleSummaryDto): OracleSummaryModel {
  return {
    activatedAtMs: toNullableBigInt(dto.activated_at),
    createdCheckpoint: toBigInt(dto.created_checkpoint),
    expiryMs: toBigInt(dto.expiry),
    lifecycleStatus: mapOracleLifecycleStatus(dto.status),
    minStrike1e9: toBigInt(dto.min_strike),
    oracleCapId: toObjectId(dto.oracle_cap_id),
    oracleId: toObjectId(dto.oracle_id),
    predictId: toObjectId(dto.predict_id),
    settlementPrice1e9: toNullableBigInt(dto.settlement_price),
    settledAtMs: toNullableBigInt(dto.settled_at),
    tickSize1e9: toBigInt(dto.tick_size),
    underlyingAsset: dto.underlying_asset,
  };
}

export function mapOracleAskBoundsDtoToModel(dto: OracleAskBoundsDto): OracleAskBoundsModel {
  if (dto === null) {
    return { status: 'UNAVAILABLE' };
  }

  return { status: 'PRESENT_UNMAPPED' };
}

function mapOraclePriceUpdateDtoToModel(dto: OraclePriceUpdateDto): OracleIndexedPriceModel {
  return {
    checkpoint: toBigInt(dto.checkpoint),
    checkpointTimestampMs: toBigInt(dto.checkpoint_timestamp_ms),
    digest: dto.digest,
    eventDigest: dto.event_digest,
    eventIndex: dto.event_index,
    forward1e9: toBigInt(dto.forward),
    onchainTimestampMs: toBigInt(dto.onchain_timestamp),
    oracleId: toObjectId(dto.oracle_id),
    packageId: normalizeObjectId(dto.package),
    sender: dto.sender as SuiAddress,
    spot1e9: toBigInt(dto.spot),
    txIndex: dto.tx_index,
  };
}

function mapOracleSviUpdateDtoToModel(dto: OracleSviUpdateDto): OracleIndexedSviModel {
  return {
    checkpoint: toBigInt(dto.checkpoint),
    checkpointTimestampMs: toBigInt(dto.checkpoint_timestamp_ms),
    digest: dto.digest,
    eventDigest: dto.event_digest,
    eventIndex: dto.event_index,
    onchainTimestampMs: toBigInt(dto.onchain_timestamp),
    oracleId: toObjectId(dto.oracle_id),
    packageId: normalizeObjectId(dto.package),
    sender: dto.sender as SuiAddress,
    svi: mapOracleSviParametersDtoToModel(dto),
    txIndex: dto.tx_index,
  };
}

function mapOracleSviParametersDtoToModel(dto: OracleSviUpdateDto): OracleSviParametersModel {
  return {
    a1e9: toBigInt(dto.a),
    b1e9: toBigInt(dto.b),
    m1e9Signed: applySign(dto.m, dto.m_negative),
    rho1e9Signed: applySign(dto.rho, dto.rho_negative),
    sigma1e9: toBigInt(dto.sigma),
  };
}

function mapOracleLifecycleStatus(status: string): OracleLifecycleStatus {
  switch (status.toLowerCase()) {
    case 'created':
    case 'inactive':
      return 'INACTIVE';
    case 'active':
      return 'ACTIVE';
    case 'pending_settlement':
    case 'pending settlement':
    case 'pending-settlement':
      return 'PENDING_SETTLEMENT';
    case 'settled':
      return 'SETTLED';
    default:
      throw new PredictAdapterError(`Unknown oracle lifecycle status: ${status}`);
  }
}

function applySign(value: number | string, isNegative: boolean) {
  const amount = toBigInt(value);
  return isNegative ? -amount : amount;
}

function toObjectId(value: ObjectIdDto) {
  return value as ObjectId;
}
