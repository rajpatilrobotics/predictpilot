import {
  createPredictServerClient,
  type PredictServerClient,
} from '@/integrations/deepbook-predict/client';
import type {
  ManagerPnlDto,
  ManagerPositionsSummaryDto,
  ManagersDto,
  ManagerSummaryDto,
} from '@/integrations/deepbook-predict/schemas';
import type { PnlPointModel } from '@/types/history';
import type { BinaryDirection, ObjectId, SuiAddress } from '@/types/predict';
import type {
  BinaryPositionSummaryModel,
  ManagerPnlModel,
  ManagerPositionsSummaryModel,
  ManagerQuoteBalanceModel,
  ManagerSummaryModel,
  PredictManagerCreatedModel,
} from '@/types/portfolio';
import {
  mapIndexedEventDtoToModel,
  normalizeMoveType,
  normalizeObjectId,
  toBigInt,
  toOptionalBigInt,
  toOptionalQuoteAmount,
  toQuoteAmount,
  toTimestampMs,
} from './mapping';

type ManagerPnlPointDtoLike = {
  timestamp_ms: number | string;
  realized_pnl?: number | string;
  cumulative_realized_pnl?: number | string;
  unrealized_pnl?: number | string;
  total_pnl?: number | string;
  account_value?: number | string;
};

type ManagerPnlSeriesDtoLike = {
  manager_id: string;
  range: 'ALL';
  series_type: string;
  current_total_pnl: number | string;
  current_unrealized_pnl: number | string;
  points: ManagerPnlPointDtoLike[];
};

export type PortfolioReadClient = Pick<
  PredictServerClient,
  | 'fetchManagerPnlDto'
  | 'fetchManagerPositionsSummaryDto'
  | 'fetchManagerSummaryDto'
  | 'fetchManagersDto'
>;

export interface GetManagersOptions {
  client?: PortfolioReadClient;
}

export interface GetManagerSummaryOptions {
  client?: PortfolioReadClient;
  managerId: ObjectId;
}

export interface GetManagerPositionsSummaryOptions {
  client?: PortfolioReadClient;
  managerId: ObjectId;
}

export interface GetManagerPnlOptions {
  client?: PortfolioReadClient;
  managerId: ObjectId;
  range?: 'ALL';
}

export async function getManagers({
  client = createPredictServerClient(),
}: GetManagersOptions = {}): Promise<PredictManagerCreatedModel[]> {
  const dto = await client.fetchManagersDto();
  return dto.map(mapManagerCreatedDtoToModel);
}

export async function getManagerSummary({
  client = createPredictServerClient(),
  managerId,
}: GetManagerSummaryOptions): Promise<ManagerSummaryModel> {
  const dto = await client.fetchManagerSummaryDto(managerId);
  return mapManagerSummaryDtoToModel(dto);
}

export async function getManagerPositionsSummary({
  client = createPredictServerClient(),
  managerId,
}: GetManagerPositionsSummaryOptions): Promise<ManagerPositionsSummaryModel> {
  const dto = await client.fetchManagerPositionsSummaryDto(managerId);
  return mapManagerPositionsSummaryDtoToModel(dto, managerId);
}

export async function getManagerPnl({
  client = createPredictServerClient(),
  managerId,
  range = 'ALL',
}: GetManagerPnlOptions): Promise<ManagerPnlModel> {
  const dto = await client.fetchManagerPnlDto(managerId, range);
  return mapManagerPnlDtoToModel(dto, managerId);
}

export function mapManagerCreatedDtoToModel(dto: ManagersDto[number]): PredictManagerCreatedModel {
  const event = mapIndexedEventDtoToModel(dto);

  return {
    ...event,
    managerId: normalizeObjectId(dto.manager_id),
    owner: dto.owner as SuiAddress,
  };
}

export function mapManagerSummaryDtoToModel(dto: ManagerSummaryDto): ManagerSummaryModel {
  return {
    accountValueQuote: toQuoteAmount(dto.account_value),
    awaitingSettlementPositions: dto.awaiting_settlement_positions,
    balances: dto.balances.map(mapManagerQuoteBalanceDtoToModel),
    lastRefreshedAtMs: null,
    managerId: normalizeObjectId(dto.manager_id),
    openExposureQuote: toQuoteAmount(dto.open_exposure),
    openPositions: dto.open_positions,
    owner: dto.owner as SuiAddress,
    realizedPnlQuote: toQuoteAmount(dto.realized_pnl),
    redeemableValueQuote: toQuoteAmount(dto.redeemable_value),
    tradingBalanceQuote: toQuoteAmount(dto.trading_balance),
    unrealizedPnlQuote: toQuoteAmount(dto.unrealized_pnl),
  };
}

export function mapManagerPositionsSummaryDtoToModel(
  dto: ManagerPositionsSummaryDto,
  managerId: ObjectId,
): ManagerPositionsSummaryModel {
  return {
    binaryPositions: dto.map(mapManagerBinaryPositionSummaryDtoToModel),
    managerId,
    rangePositions: [],
  };
}

export function mapManagerPnlDtoToModel(dto: ManagerPnlDto, managerId: ObjectId): ManagerPnlModel {
  if (Array.isArray(dto)) {
    const points = dto.map((point) => mapManagerPnlPointDtoToModel(point));
    const lastPoint = points.at(-1);

    return {
      currentTotalPnlQuote: lastPoint?.pnlQuote ?? 0n,
      currentUnrealizedPnlQuote: lastPoint?.unrealizedPnlQuote ?? 0n,
      managerId,
      points,
      range: 'ALL',
      seriesType: null,
    };
  }

  const series = dto as ManagerPnlSeriesDtoLike;

  return {
    currentTotalPnlQuote: toQuoteAmount(series.current_total_pnl),
    currentUnrealizedPnlQuote: toQuoteAmount(series.current_unrealized_pnl),
    managerId: normalizeObjectId(series.manager_id),
    points: series.points.map(mapManagerPnlPointDtoToModel),
    range: series.range,
    seriesType: series.series_type,
  };
}

function mapManagerQuoteBalanceDtoToModel(
  dto: ManagerSummaryDto['balances'][number],
): ManagerQuoteBalanceModel {
  return {
    balanceQuote: toQuoteAmount(dto.balance),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
  };
}

function mapManagerBinaryPositionSummaryDtoToModel(
  dto: ManagerPositionsSummaryDto[number],
): BinaryPositionSummaryModel {
  const direction: BinaryDirection = dto.is_up ? 'UP' : 'DOWN';

  return {
    averageEntryPrice1e9: toOptionalBigInt(dto.average_entry_price),
    averageExitPrice1e9: toOptionalBigInt(dto.average_exit_price),
    firstMintedAtMs: toTimestampMs(dto.first_minted_at),
    key: {
      direction,
      expiryMs: toTimestampMs(dto.expiry),
      oracleId: normalizeObjectId(dto.oracle_id),
      strike1e9: toBigInt(dto.strike),
    },
    lastActivityAtMs: toTimestampMs(dto.last_activity_at),
    managerId: normalizeObjectId(dto.manager_id),
    markPrice1e9: toOptionalBigInt(dto.mark_price),
    markValueQuote: toOptionalQuoteAmount(dto.mark_value),
    mintedQuantityQuote: toQuoteAmount(dto.minted_quantity),
    openCostBasisQuote: toQuoteAmount(dto.open_cost_basis),
    openQuantityQuote: toQuoteAmount(dto.open_quantity),
    predictId: normalizeObjectId(dto.predict_id),
    quantityQuote: toQuoteAmount(dto.open_quantity),
    quoteAssetType: normalizeMoveType(dto.quote_asset),
    realizedPnlQuote: toQuoteAmount(dto.realized_pnl),
    redeemedQuantityQuote: toQuoteAmount(dto.redeemed_quantity),
    status: dto.status,
    totalCostQuote: toQuoteAmount(dto.total_cost),
    totalPayoutQuote: toQuoteAmount(dto.total_payout),
    underlyingAsset: dto.underlying_asset,
    unrealizedPnlQuote: toQuoteAmount(dto.unrealized_pnl),
  };
}

function mapManagerPnlPointDtoToModel(point: ManagerPnlPointDtoLike): PnlPointModel {
  const realizedPnlQuote = toOptionalQuoteAmount(point.realized_pnl);
  const cumulativeRealizedPnlQuote = toOptionalQuoteAmount(point.cumulative_realized_pnl);
  const unrealizedPnlQuote = toOptionalQuoteAmount(point.unrealized_pnl);
  const totalPnlQuote = toOptionalQuoteAmount(point.total_pnl);
  const pnlQuote = totalPnlQuote ?? cumulativeRealizedPnlQuote ?? realizedPnlQuote ?? 0n;

  return {
    cumulativeRealizedPnlQuote,
    equityQuote: toOptionalQuoteAmount(point.account_value),
    pnlQuote,
    realizedPnlQuote,
    timestampMs: toTimestampMs(point.timestamp_ms),
    totalPnlQuote,
    unrealizedPnlQuote,
  };
}
