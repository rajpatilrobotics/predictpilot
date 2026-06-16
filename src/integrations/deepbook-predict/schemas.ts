import { z } from 'zod';

export const ObjectIdSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected a 32-byte Sui object ID');
export const SuiAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected a 32-byte Sui address');
export const MoveTypeSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/,
    'Expected a fully qualified Move type',
  );

export const StatusQuerySchema = z
  .object({
    max_checkpoint_lag: z.number().int().nonnegative().optional(),
    max_time_lag_seconds: z.number().int().nonnegative().optional(),
  })
  .strict();

export const PathPredictIdSchema = z
  .object({
    predictId: ObjectIdSchema,
  })
  .strict();

export const PathOracleIdSchema = z
  .object({
    oracleId: ObjectIdSchema,
  })
  .strict();

export const PathManagerIdSchema = z
  .object({
    managerId: ObjectIdSchema,
  })
  .strict();

export const RangeQueryVerifiedSchema = z
  .object({
    range: z.literal('ALL'),
  })
  .strict();

const UnknownObjectDtoSchema = z.record(z.string(), z.unknown());
const UnknownListDtoSchema = z.array(z.unknown());

const PredictServerStatusPipelineSchema = z
  .object({
    pipeline: z.string(),
    indexed_checkpoint: z.number(),
    indexed_epoch: z.number(),
    indexed_timestamp_ms: z.number(),
    checkpoint_lag: z.number(),
    time_lag_seconds: z.number(),
    latest_onchain_checkpoint: z.number(),
  })
  .strict();

export const PredictServerStatusDtoSchema = z
  .object({
    status: z.enum(['OK', 'UNHEALTHY']),
    latest_onchain_checkpoint: z.number(),
    current_time_ms: z.number(),
    earliest_checkpoint: z.number(),
    max_lag_pipeline: z.string(),
    pipelines: z.array(PredictServerStatusPipelineSchema),
    max_checkpoint_lag: z.number(),
    max_time_lag_seconds: z.number(),
  })
  .strict();

export const PredictStateDtoSchema = UnknownObjectDtoSchema;
export const PredictOraclesDtoSchema = UnknownListDtoSchema;
export const OracleStateDtoSchema = UnknownObjectDtoSchema;
export const QuoteAssetsDtoSchema = UnknownListDtoSchema;
export const OracleAskBoundsDtoSchema = UnknownObjectDtoSchema;
export const VaultSummaryDtoSchema = UnknownObjectDtoSchema;
export const VaultPerformanceDtoSchema = UnknownListDtoSchema;
export const ManagersDtoSchema = UnknownListDtoSchema;
export const ManagerSummaryDtoSchema = UnknownObjectDtoSchema;
export const ManagerPositionsSummaryDtoSchema = UnknownObjectDtoSchema;
export const ManagerPnlDtoSchema = z.union([UnknownListDtoSchema, UnknownObjectDtoSchema]);
export const OraclePricesDtoSchema = UnknownListDtoSchema;
export const OracleLatestPriceDtoSchema = UnknownObjectDtoSchema;
export const OracleSviDtoSchema = UnknownListDtoSchema;
export const OracleLatestSviDtoSchema = UnknownObjectDtoSchema;
export const PositionMintHistoryDtoSchema = UnknownListDtoSchema;
export const PositionRedeemHistoryDtoSchema = UnknownListDtoSchema;
export const RangeMintHistoryDtoSchema = UnknownListDtoSchema;
export const RangeRedeemHistoryDtoSchema = UnknownListDtoSchema;
export const LpSuppliesHistoryDtoSchema = UnknownListDtoSchema;
export const LpWithdrawalsHistoryDtoSchema = UnknownListDtoSchema;
export const OracleTradesDtoSchema = UnknownListDtoSchema;

export type ObjectIdDto = z.infer<typeof ObjectIdSchema>;
export type SuiAddressDto = z.infer<typeof SuiAddressSchema>;
export type MoveTypeDto = z.infer<typeof MoveTypeSchema>;
export type StatusQuery = z.infer<typeof StatusQuerySchema>;
export type PathPredictId = z.infer<typeof PathPredictIdSchema>;
export type PathOracleId = z.infer<typeof PathOracleIdSchema>;
export type PathManagerId = z.infer<typeof PathManagerIdSchema>;
export type RangeQueryVerified = z.infer<typeof RangeQueryVerifiedSchema>;
export type PredictServerStatusDto = z.infer<typeof PredictServerStatusDtoSchema>;
export type PredictStateDto = z.infer<typeof PredictStateDtoSchema>;
export type PredictOraclesDto = z.infer<typeof PredictOraclesDtoSchema>;
export type OracleStateDto = z.infer<typeof OracleStateDtoSchema>;
export type QuoteAssetsDto = z.infer<typeof QuoteAssetsDtoSchema>;
export type OracleAskBoundsDto = z.infer<typeof OracleAskBoundsDtoSchema>;
export type VaultSummaryDto = z.infer<typeof VaultSummaryDtoSchema>;
export type VaultPerformanceDto = z.infer<typeof VaultPerformanceDtoSchema>;
export type ManagersDto = z.infer<typeof ManagersDtoSchema>;
export type ManagerSummaryDto = z.infer<typeof ManagerSummaryDtoSchema>;
export type ManagerPositionsSummaryDto = z.infer<typeof ManagerPositionsSummaryDtoSchema>;
export type ManagerPnlDto = z.infer<typeof ManagerPnlDtoSchema>;
export type OraclePricesDto = z.infer<typeof OraclePricesDtoSchema>;
export type OracleLatestPriceDto = z.infer<typeof OracleLatestPriceDtoSchema>;
export type OracleSviDto = z.infer<typeof OracleSviDtoSchema>;
export type OracleLatestSviDto = z.infer<typeof OracleLatestSviDtoSchema>;
export type PositionMintHistoryDto = z.infer<typeof PositionMintHistoryDtoSchema>;
export type PositionRedeemHistoryDto = z.infer<typeof PositionRedeemHistoryDtoSchema>;
export type RangeMintHistoryDto = z.infer<typeof RangeMintHistoryDtoSchema>;
export type RangeRedeemHistoryDto = z.infer<typeof RangeRedeemHistoryDtoSchema>;
export type LpSuppliesHistoryDto = z.infer<typeof LpSuppliesHistoryDtoSchema>;
export type LpWithdrawalsHistoryDto = z.infer<typeof LpWithdrawalsHistoryDtoSchema>;
export type OracleTradesDto = z.infer<typeof OracleTradesDtoSchema>;
