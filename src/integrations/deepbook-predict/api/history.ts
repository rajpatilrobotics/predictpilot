import {
  createPredictServerClient,
  type PredictServerClient,
} from '@/integrations/deepbook-predict/client';
import type {
  LpSuppliesHistoryDto,
  LpWithdrawalsHistoryDto,
  OracleTradesDto,
  PositionMintHistoryDto,
  PositionRedeemHistoryDto,
  RangeMintHistoryDto,
  RangeRedeemHistoryDto,
} from '@/integrations/deepbook-predict/schemas';
import type {
  BinaryMintHistoryRecord,
  BinaryRedeemHistoryRecord,
  LpSupplyHistoryRecord,
  LpWithdrawHistoryRecord,
  OracleTradeHistoryRecord,
  RangeMintHistoryRecord,
  RangeRedeemHistoryRecord,
} from '@/types/history';
import type { BinaryDirection, ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import {
  mapIndexedEventDtoToModel,
  normalizeMoveType,
  normalizeObjectId,
  toBigInt,
  toOptionalQuoteAmount,
  toQuoteAmount,
  toTimestampMs,
} from './mapping';

type HistoryRecordObject = Record<string, unknown>;

type HistoryRecordBase = {
  digest: string;
  timestampMs: bigint;
  eventDigest: string;
  sender: SuiAddress;
  checkpoint: bigint;
  packageId: ObjectId;
  txIndex: number;
  eventIndex: number;
};

export type HistoryReadClient = Pick<
  PredictServerClient,
  | 'fetchLpSuppliesHistoryDto'
  | 'fetchLpWithdrawalsHistoryDto'
  | 'fetchOracleTradesDto'
  | 'fetchPositionMintHistoryDto'
  | 'fetchPositionRedeemHistoryDto'
  | 'fetchRangeMintHistoryDto'
  | 'fetchRangeRedeemHistoryDto'
>;

export interface GetOracleTradesOptions {
  client?: HistoryReadClient;
  oracleId: ObjectId;
}

export interface GetHistoryFeedOptions {
  client?: HistoryReadClient;
}

export async function getPositionMintHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<BinaryMintHistoryRecord[]> {
  const dto = await client.fetchPositionMintHistoryDto();
  return dto.map(mapBinaryMintHistoryDtoToModel);
}

export async function getPositionRedeemHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<BinaryRedeemHistoryRecord[]> {
  const dto = await client.fetchPositionRedeemHistoryDto();
  return dto.map(mapBinaryRedeemHistoryDtoToModel);
}

export async function getRangeMintHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<RangeMintHistoryRecord[]> {
  const dto = await client.fetchRangeMintHistoryDto();
  return dto.map(mapRangeMintHistoryDtoToModel);
}

export async function getRangeRedeemHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<RangeRedeemHistoryRecord[]> {
  const dto = await client.fetchRangeRedeemHistoryDto();
  return dto.map(mapRangeRedeemHistoryDtoToModel);
}

export async function getLpSuppliesHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<LpSupplyHistoryRecord[]> {
  const dto = await client.fetchLpSuppliesHistoryDto();
  return dto.map(mapLpSupplyHistoryDtoToModel);
}

export async function getLpWithdrawalsHistory({
  client = createPredictServerClient(),
}: GetHistoryFeedOptions = {}): Promise<LpWithdrawHistoryRecord[]> {
  const dto = await client.fetchLpWithdrawalsHistoryDto();
  return dto.map(mapLpWithdrawalHistoryDtoToModel);
}

export async function getOracleTrades({
  client = createPredictServerClient(),
  oracleId,
}: GetOracleTradesOptions): Promise<OracleTradeHistoryRecord[]> {
  const dto = await client.fetchOracleTradesDto(oracleId);
  return dto.map((record) => mapOracleTradeHistoryDtoToModel(record, oracleId));
}

export function mapBinaryMintHistoryDtoToModel(
  dto: PositionMintHistoryDto[number],
): BinaryMintHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    askPrice1e9: toOptionalQuoteAmount(dto.ask_price),
    costQuote: toQuoteAmount(dto.cost),
    key: {
      direction: mapBinaryDirection(dto.is_up),
      expiryMs: toTimestampMs(dto.expiry),
      oracleId: normalizeObjectId(dto.oracle_id),
      strike1e9: toBigInt(dto.strike),
    },
    kind: 'BINARY_MINT',
    managerId: normalizeObjectId(dto.manager_id),
    predictId: normalizeObjectId(dto.predict_id),
    quantityQuote: toQuoteAmount(dto.quantity),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    trader: dto.trader as SuiAddress,
  };
}

export function mapBinaryRedeemHistoryDtoToModel(
  dto: PositionRedeemHistoryDto[number],
): BinaryRedeemHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    bidPrice1e9: toOptionalQuoteAmount(dto.bid_price),
    executor: dto.executor as SuiAddress,
    isSettled: dto.is_settled,
    key: {
      direction: mapBinaryDirection(dto.is_up),
      expiryMs: toTimestampMs(dto.expiry),
      oracleId: normalizeObjectId(dto.oracle_id),
      strike1e9: toBigInt(dto.strike),
    },
    kind: 'BINARY_REDEEM',
    managerId: normalizeObjectId(dto.manager_id),
    owner: dto.owner as SuiAddress,
    payoutQuote: toQuoteAmount(dto.payout),
    predictId: normalizeObjectId(dto.predict_id),
    quantityQuote: toQuoteAmount(dto.quantity),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
  };
}

export function mapRangeMintHistoryDtoToModel(
  dto: RangeMintHistoryDto[number],
): RangeMintHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    askPrice1e9: toOptionalQuoteAmount(dto.ask_price),
    costQuote: toQuoteAmount(dto.cost),
    key: {
      expiryMs: toTimestampMs(dto.expiry),
      higherStrike1e9: toBigInt(dto.higher_strike),
      lowerStrike1e9: toBigInt(dto.lower_strike),
      oracleId: normalizeObjectId(dto.oracle_id),
    },
    kind: 'RANGE_MINT',
    managerId: normalizeObjectId(dto.manager_id),
    predictId: normalizeObjectId(dto.predict_id),
    quantityQuote: toQuoteAmount(dto.quantity),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    trader: dto.trader as SuiAddress,
  };
}

export function mapRangeRedeemHistoryDtoToModel(
  dto: RangeRedeemHistoryDto[number],
): RangeRedeemHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    bidPrice1e9: toOptionalQuoteAmount(dto.bid_price),
    isSettled: dto.is_settled,
    key: {
      expiryMs: toTimestampMs(dto.expiry),
      higherStrike1e9: toBigInt(dto.higher_strike),
      lowerStrike1e9: toBigInt(dto.lower_strike),
      oracleId: normalizeObjectId(dto.oracle_id),
    },
    kind: 'RANGE_REDEEM',
    managerId: normalizeObjectId(dto.manager_id),
    payoutQuote: toQuoteAmount(dto.payout),
    predictId: normalizeObjectId(dto.predict_id),
    quantityQuote: toQuoteAmount(dto.quantity),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    trader: dto.trader as SuiAddress,
  };
}

export function mapLpSupplyHistoryDtoToModel(
  dto: LpSuppliesHistoryDto[number],
): LpSupplyHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    kind: 'LP_SUPPLY',
    mintedPlpAtomic: toBigInt(dto.shares_minted),
    predictId: normalizeObjectId(dto.predict_id),
    provider: dto.supplier as SuiAddress,
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    suppliedQuote: toQuoteAmount(dto.amount),
  };
}

export function mapLpWithdrawalHistoryDtoToModel(
  dto: LpWithdrawalsHistoryDto[number],
): LpWithdrawHistoryRecord {
  return {
    ...mapHistoryRecordBase(dto),
    burnedPlpAtomic: toBigInt(dto.shares_burned),
    kind: 'LP_WITHDRAW',
    predictId: normalizeObjectId(dto.predict_id),
    provider: dto.withdrawer as SuiAddress,
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    withdrawnQuote: toQuoteAmount(dto.amount),
  };
}

export function mapOracleTradeHistoryDtoToModel(
  dto: OracleTradesDto[number],
  fallbackOracleId: ObjectId,
): OracleTradeHistoryRecord {
  const raw = dto as HistoryRecordObject;
  const oracleId = readString(raw, 'oracle_id');
  const isUp = readBoolean(raw, 'is_up');

  return {
    ...mapHistoryRecordBase(dto),
    costQuote: readOptionalQuoteAmount(raw, 'cost'),
    direction: isUp === undefined ? undefined : mapBinaryDirection(isUp),
    kind: 'ORACLE_TRADE',
    oracleId: oracleId === undefined ? fallbackOracleId : normalizeObjectId(oracleId),
    payoutQuote: readOptionalQuoteAmount(raw, 'payout'),
    quantityQuote: readOptionalQuoteAmount(raw, 'quantity'),
    trader: readString(raw, 'trader') as SuiAddress | undefined,
  };
}

function mapHistoryRecordBase(
  dto: Parameters<typeof mapIndexedEventDtoToModel>[0],
): HistoryRecordBase {
  const event = mapIndexedEventDtoToModel(dto);

  return {
    checkpoint: event.checkpoint,
    digest: event.digest,
    eventDigest: event.eventDigest,
    eventIndex: event.eventIndex,
    packageId: event.packageId,
    sender: event.sender,
    timestampMs: event.checkpointTimestampMs,
    txIndex: event.txIndex,
  };
}

function mapBinaryDirection(isUp: boolean): BinaryDirection {
  return isUp ? 'UP' : 'DOWN';
}

function readOptionalQuoteAmount(
  record: HistoryRecordObject,
  field: string,
): QuoteAmount | undefined {
  const value = record[field];

  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined;
  }

  return toQuoteAmount(value);
}

function readString(record: HistoryRecordObject, field: string): string | undefined {
  const value = record[field];
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(record: HistoryRecordObject, field: string): boolean | undefined {
  const value = record[field];
  return typeof value === 'boolean' ? value : undefined;
}
