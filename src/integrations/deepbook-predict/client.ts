import { predictDeploymentConfig, predictServerEndpoints } from '@/config/predict';
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
import type { ObjectId } from '@/types/predict';
import type { z } from 'zod';

export interface PredictServerClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retries?: number;
}

export function createPredictServerClient({
  baseUrl = predictDeploymentConfig.serverBaseUrl,
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

  function predictIdPath(predictId: ObjectIdDto): ObjectId {
    const parsed = PathPredictIdSchema.parse({ predictId });
    return parsed.predictId as ObjectId;
  }

  function oracleIdPath(oracleId: ObjectIdDto): ObjectId {
    const parsed = PathOracleIdSchema.parse({ oracleId });
    return parsed.oracleId as ObjectId;
  }

  function managerIdPath(managerId: ObjectIdDto): ObjectId {
    const parsed = PathManagerIdSchema.parse({ managerId });
    return parsed.managerId as ObjectId;
  }

  function rangeQuery(range: 'ALL') {
    return RangeQueryVerifiedSchema.parse({ range });
  }

  return {
    fetchPredictServerStatus(query: StatusQuery = {}): Promise<PredictServerStatusDto> {
      return request({
        path: predictServerEndpoints.status(),
        query: StatusQuerySchema.parse(query),
        schema: PredictServerStatusDtoSchema,
      });
    },

    fetchPredictStateDto(predictId: ObjectIdDto): Promise<PredictStateDto> {
      const id = predictIdPath(predictId);
      return request({
        path: predictServerEndpoints.predictState(id),
        schema: PredictStateDtoSchema,
      });
    },

    fetchPredictOraclesDto(predictId: ObjectIdDto): Promise<PredictOraclesDto> {
      const id = predictIdPath(predictId);
      return request({
        path: predictServerEndpoints.predictOracles(id),
        schema: PredictOraclesDtoSchema,
      });
    },

    fetchPredictQuoteAssetsDto(predictId: ObjectIdDto): Promise<QuoteAssetsDto> {
      const id = predictIdPath(predictId);
      return request({
        path: predictServerEndpoints.predictQuoteAssets(id),
        schema: QuoteAssetsDtoSchema,
      });
    },

    fetchOracleStateDto(oracleId: ObjectIdDto): Promise<OracleStateDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleState(id),
        schema: OracleStateDtoSchema,
      });
    },

    fetchOracleAskBoundsDto(oracleId: ObjectIdDto): Promise<OracleAskBoundsDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleAskBounds(id),
        schema: OracleAskBoundsDtoSchema,
      });
    },

    fetchVaultSummaryDto(predictId: ObjectIdDto): Promise<VaultSummaryDto> {
      const id = predictIdPath(predictId);
      return request({
        path: predictServerEndpoints.vaultSummary(id),
        schema: VaultSummaryDtoSchema,
      });
    },

    fetchVaultPerformanceDto(
      predictId: ObjectIdDto,
      range: 'ALL' = 'ALL',
    ): Promise<VaultPerformanceDto> {
      const id = predictIdPath(predictId);
      return request({
        path: predictServerEndpoints.vaultPerformance(id),
        query: rangeQuery(range),
        schema: VaultPerformanceDtoSchema,
      });
    },

    fetchManagersDto(): Promise<ManagersDto> {
      return request({
        path: predictServerEndpoints.managers(),
        schema: ManagersDtoSchema,
      });
    },

    fetchManagerSummaryDto(managerId: ObjectIdDto): Promise<ManagerSummaryDto> {
      const id = managerIdPath(managerId);
      return request({
        path: predictServerEndpoints.managerSummary(id),
        schema: ManagerSummaryDtoSchema,
      });
    },

    fetchManagerPositionsSummaryDto(managerId: ObjectIdDto): Promise<ManagerPositionsSummaryDto> {
      const id = managerIdPath(managerId);
      return request({
        path: predictServerEndpoints.managerPositionsSummary(id),
        schema: ManagerPositionsSummaryDtoSchema,
      });
    },

    fetchManagerPnlDto(managerId: ObjectIdDto, range: 'ALL' = 'ALL'): Promise<ManagerPnlDto> {
      const id = managerIdPath(managerId);
      return request({
        path: predictServerEndpoints.managerPnl(id),
        query: rangeQuery(range),
        schema: ManagerPnlDtoSchema,
      });
    },

    fetchOraclePricesDto(oracleId: ObjectIdDto): Promise<OraclePricesDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oraclePrices(id),
        schema: OraclePricesDtoSchema,
      });
    },

    fetchOracleLatestPriceDto(oracleId: ObjectIdDto): Promise<OracleLatestPriceDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleLatestPrice(id),
        schema: OracleLatestPriceDtoSchema,
      });
    },

    fetchOracleSviDto(oracleId: ObjectIdDto): Promise<OracleSviDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleSvi(id),
        schema: OracleSviDtoSchema,
      });
    },

    fetchOracleLatestSviDto(oracleId: ObjectIdDto): Promise<OracleLatestSviDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleLatestSvi(id),
        schema: OracleLatestSviDtoSchema,
      });
    },

    fetchPositionMintHistoryDto(): Promise<PositionMintHistoryDto> {
      return request({
        path: predictServerEndpoints.historyPositionsMinted(),
        schema: PositionMintHistoryDtoSchema,
      });
    },

    fetchPositionRedeemHistoryDto(): Promise<PositionRedeemHistoryDto> {
      return request({
        path: predictServerEndpoints.historyPositionsRedeemed(),
        schema: PositionRedeemHistoryDtoSchema,
      });
    },

    fetchRangeMintHistoryDto(): Promise<RangeMintHistoryDto> {
      return request({
        path: predictServerEndpoints.historyRangesMinted(),
        schema: RangeMintHistoryDtoSchema,
      });
    },

    fetchRangeRedeemHistoryDto(): Promise<RangeRedeemHistoryDto> {
      return request({
        path: predictServerEndpoints.historyRangesRedeemed(),
        schema: RangeRedeemHistoryDtoSchema,
      });
    },

    fetchLpSuppliesHistoryDto(): Promise<LpSuppliesHistoryDto> {
      return request({
        path: predictServerEndpoints.historyLpSupplies(),
        schema: LpSuppliesHistoryDtoSchema,
      });
    },

    fetchLpWithdrawalsHistoryDto(): Promise<LpWithdrawalsHistoryDto> {
      return request({
        path: predictServerEndpoints.historyLpWithdrawals(),
        schema: LpWithdrawalsHistoryDtoSchema,
      });
    },

    fetchOracleTradesDto(oracleId: ObjectIdDto): Promise<OracleTradesDto> {
      const id = oracleIdPath(oracleId);
      return request({
        path: predictServerEndpoints.oracleTrades(id),
        schema: OracleTradesDtoSchema,
      });
    },
  };
}

export type PredictServerClient = ReturnType<typeof createPredictServerClient>;
