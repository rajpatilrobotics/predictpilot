import { deepbookPredictConfig } from '@/config/deepbookPredict';
import { fetchJson, type FetchLike, type HttpQuery } from '@/lib/http';
import {
  LpSuppliesHistoryDtoSchema,
  LpWithdrawalsHistoryDtoSchema,
  ManagerPnlDtoSchema,
  ManagerPositionsSummaryDtoSchema,
  ManagerSummaryDtoSchema,
  ManagersDtoSchema,
  OracleAskBoundsDtoSchema,
  OracleLatestPriceDtoSchema,
  OracleLatestSviDtoSchema,
  OraclePricesDtoSchema,
  OracleStateDtoSchema,
  OracleSviDtoSchema,
  OracleTradesDtoSchema,
  PathManagerIdSchema,
  PathOracleIdSchema,
  PathPredictIdSchema,
  PositionMintHistoryDtoSchema,
  PositionRedeemHistoryDtoSchema,
  PredictOraclesDtoSchema,
  PredictServerStatusDtoSchema,
  PredictStateDtoSchema,
  QuoteAssetsDtoSchema,
  RangeMintHistoryDtoSchema,
  RangeQueryVerifiedSchema,
  RangeRedeemHistoryDtoSchema,
  StatusQuerySchema,
  VaultPerformanceDtoSchema,
  VaultSummaryDtoSchema,
  type LpSuppliesHistoryDto,
  type LpWithdrawalsHistoryDto,
  type ManagerPnlDto,
  type ManagerPositionsSummaryDto,
  type ManagerSummaryDto,
  type ManagersDto,
  type ObjectIdDto,
  type OracleAskBoundsDto,
  type OracleLatestPriceDto,
  type OracleLatestSviDto,
  type OraclePricesDto,
  type OracleStateDto,
  type OracleSviDto,
  type OracleTradesDto,
  type PositionMintHistoryDto,
  type PositionRedeemHistoryDto,
  type PredictOraclesDto,
  type PredictServerStatusDto,
  type PredictStateDto,
  type QuoteAssetsDto,
  type RangeMintHistoryDto,
  type RangeRedeemHistoryDto,
  type StatusQuery,
  type VaultPerformanceDto,
  type VaultSummaryDto,
} from './schemas';
import type { z } from 'zod';

export interface PredictServerClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retries?: number;
}

export function createPredictServerClient({
  baseUrl = deepbookPredictConfig.predictServerUrl,
  fetchImpl,
  retries,
  timeoutMs,
}: PredictServerClientOptions = {}) {
  function request<TData>({
    path,
    query,
    schema,
  }: {
    path: string;
    query?: HttpQuery;
    schema: z.ZodType<TData>;
  }) {
    return fetchJson({
      baseUrl,
      fetchImpl,
      path,
      query,
      retries,
      schema,
      timeoutMs,
    });
  }

  function predictIdPath(predictId: ObjectIdDto) {
    const parsed = PathPredictIdSchema.parse({ predictId });
    return parsed.predictId;
  }

  function oracleIdPath(oracleId: ObjectIdDto) {
    const parsed = PathOracleIdSchema.parse({ oracleId });
    return parsed.oracleId;
  }

  function managerIdPath(managerId: ObjectIdDto) {
    const parsed = PathManagerIdSchema.parse({ managerId });
    return parsed.managerId;
  }

  function rangeQuery(range: 'ALL') {
    return RangeQueryVerifiedSchema.parse({ range });
  }

  return {
    fetchPredictServerStatus(query: StatusQuery = {}): Promise<PredictServerStatusDto> {
      return request({
        path: '/status',
        query: StatusQuerySchema.parse(query),
        schema: PredictServerStatusDtoSchema,
      });
    },

    fetchPredictStateDto(predictId: ObjectIdDto): Promise<PredictStateDto> {
      const id = predictIdPath(predictId);
      return request({
        path: `/predicts/${id}/state`,
        schema: PredictStateDtoSchema,
      });
    },

    fetchPredictOraclesDto(predictId: ObjectIdDto): Promise<PredictOraclesDto> {
      const id = predictIdPath(predictId);
      return request({
        path: `/predicts/${id}/oracles`,
        schema: PredictOraclesDtoSchema,
      });
    },

    fetchPredictQuoteAssetsDto(predictId: ObjectIdDto): Promise<QuoteAssetsDto> {
      const id = predictIdPath(predictId);
      return request({
        path: `/predicts/${id}/quote-assets`,
        schema: QuoteAssetsDtoSchema,
      });
    },

    fetchOracleStateDto(oracleId: ObjectIdDto): Promise<OracleStateDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/state`,
        schema: OracleStateDtoSchema,
      });
    },

    fetchOracleAskBoundsDto(oracleId: ObjectIdDto): Promise<OracleAskBoundsDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/ask-bounds`,
        schema: OracleAskBoundsDtoSchema,
      });
    },

    fetchVaultSummaryDto(predictId: ObjectIdDto): Promise<VaultSummaryDto> {
      const id = predictIdPath(predictId);
      return request({
        path: `/predicts/${id}/vault/summary`,
        schema: VaultSummaryDtoSchema,
      });
    },

    fetchVaultPerformanceDto(
      predictId: ObjectIdDto,
      range: 'ALL' = 'ALL',
    ): Promise<VaultPerformanceDto> {
      const id = predictIdPath(predictId);
      return request({
        path: `/predicts/${id}/vault/performance`,
        query: rangeQuery(range),
        schema: VaultPerformanceDtoSchema,
      });
    },

    fetchManagersDto(): Promise<ManagersDto> {
      return request({
        path: '/managers',
        schema: ManagersDtoSchema,
      });
    },

    fetchManagerSummaryDto(managerId: ObjectIdDto): Promise<ManagerSummaryDto> {
      const id = managerIdPath(managerId);
      return request({
        path: `/managers/${id}/summary`,
        schema: ManagerSummaryDtoSchema,
      });
    },

    fetchManagerPositionsSummaryDto(managerId: ObjectIdDto): Promise<ManagerPositionsSummaryDto> {
      const id = managerIdPath(managerId);
      return request({
        path: `/managers/${id}/positions/summary`,
        schema: ManagerPositionsSummaryDtoSchema,
      });
    },

    fetchManagerPnlDto(managerId: ObjectIdDto, range: 'ALL' = 'ALL'): Promise<ManagerPnlDto> {
      const id = managerIdPath(managerId);
      return request({
        path: `/managers/${id}/pnl`,
        query: rangeQuery(range),
        schema: ManagerPnlDtoSchema,
      });
    },

    fetchOraclePricesDto(oracleId: ObjectIdDto): Promise<OraclePricesDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/prices`,
        schema: OraclePricesDtoSchema,
      });
    },

    fetchOracleLatestPriceDto(oracleId: ObjectIdDto): Promise<OracleLatestPriceDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/prices/latest`,
        schema: OracleLatestPriceDtoSchema,
      });
    },

    fetchOracleSviDto(oracleId: ObjectIdDto): Promise<OracleSviDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/svi`,
        schema: OracleSviDtoSchema,
      });
    },

    fetchOracleLatestSviDto(oracleId: ObjectIdDto): Promise<OracleLatestSviDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/oracles/${id}/svi/latest`,
        schema: OracleLatestSviDtoSchema,
      });
    },

    fetchPositionMintHistoryDto(): Promise<PositionMintHistoryDto> {
      return request({
        path: '/positions/minted',
        schema: PositionMintHistoryDtoSchema,
      });
    },

    fetchPositionRedeemHistoryDto(): Promise<PositionRedeemHistoryDto> {
      return request({
        path: '/positions/redeemed',
        schema: PositionRedeemHistoryDtoSchema,
      });
    },

    fetchRangeMintHistoryDto(): Promise<RangeMintHistoryDto> {
      return request({
        path: '/ranges/minted',
        schema: RangeMintHistoryDtoSchema,
      });
    },

    fetchRangeRedeemHistoryDto(): Promise<RangeRedeemHistoryDto> {
      return request({
        path: '/ranges/redeemed',
        schema: RangeRedeemHistoryDtoSchema,
      });
    },

    fetchLpSuppliesHistoryDto(): Promise<LpSuppliesHistoryDto> {
      return request({
        path: '/lp/supplies',
        schema: LpSuppliesHistoryDtoSchema,
      });
    },

    fetchLpWithdrawalsHistoryDto(): Promise<LpWithdrawalsHistoryDto> {
      return request({
        path: '/lp/withdrawals',
        schema: LpWithdrawalsHistoryDtoSchema,
      });
    },

    fetchOracleTradesDto(oracleId: ObjectIdDto): Promise<OracleTradesDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: `/trades/${id}`,
        schema: OracleTradesDtoSchema,
      });
    },
  };
}

export type PredictServerClient = ReturnType<typeof createPredictServerClient>;
