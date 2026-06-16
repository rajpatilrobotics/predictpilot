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
const IntegerishDtoSchema = z.union([z.number().int(), z.string().regex(/^-?\d+$/)]);
const NumberishDtoSchema = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]);

const IndexedEventBaseDtoSchema = z
  .object({
    event_digest: z.string(),
    digest: z.string(),
    sender: SuiAddressSchema,
    checkpoint: IntegerishDtoSchema,
    checkpoint_timestamp_ms: IntegerishDtoSchema,
    tx_index: z.number().int().nonnegative(),
    event_index: z.number().int().nonnegative(),
    package: z.string(),
  })
  .passthrough();

const QuoteBalanceDtoSchema = z
  .object({
    quote_asset: z.string(),
    balance: IntegerishDtoSchema,
  })
  .passthrough();

const VaultPerformancePointDtoSchema = z
  .object({
    timestamp_ms: IntegerishDtoSchema,
    share_price: NumberishDtoSchema,
    vault_value: IntegerishDtoSchema,
    total_shares: IntegerishDtoSchema,
  })
  .passthrough();

const ManagerPositionSummaryRowDtoSchema = z
  .object({
    predict_id: ObjectIdSchema,
    manager_id: ObjectIdSchema,
    quote_asset: z.string(),
    oracle_id: ObjectIdSchema,
    underlying_asset: z.string(),
    expiry: IntegerishDtoSchema,
    strike: IntegerishDtoSchema,
    is_up: z.boolean(),
    minted_quantity: IntegerishDtoSchema,
    redeemed_quantity: IntegerishDtoSchema,
    open_quantity: IntegerishDtoSchema,
    total_cost: IntegerishDtoSchema,
    total_payout: IntegerishDtoSchema,
    realized_pnl: IntegerishDtoSchema,
    unrealized_pnl: IntegerishDtoSchema,
    open_cost_basis: IntegerishDtoSchema,
    average_entry_price: IntegerishDtoSchema.nullable(),
    average_exit_price: IntegerishDtoSchema.nullable(),
    mark_price: IntegerishDtoSchema.nullable(),
    mark_value: IntegerishDtoSchema.nullable(),
    status: z.string(),
    first_minted_at: IntegerishDtoSchema,
    last_activity_at: IntegerishDtoSchema,
  })
  .passthrough();

const ManagerPnlPointDtoSchema = z
  .object({
    timestamp_ms: IntegerishDtoSchema,
    realized_pnl: IntegerishDtoSchema.optional(),
    cumulative_realized_pnl: IntegerishDtoSchema.optional(),
    unrealized_pnl: IntegerishDtoSchema.optional(),
    total_pnl: IntegerishDtoSchema.optional(),
    account_value: IntegerishDtoSchema.optional(),
  })
  .passthrough();

const BinaryMintHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  manager_id: ObjectIdSchema,
  trader: SuiAddressSchema,
  quote_asset: z.string(),
  oracle_id: ObjectIdSchema,
  expiry: IntegerishDtoSchema,
  strike: IntegerishDtoSchema,
  is_up: z.boolean(),
  quantity: IntegerishDtoSchema,
  cost: IntegerishDtoSchema,
  ask_price: IntegerishDtoSchema.optional(),
}).passthrough();

const BinaryRedeemHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  manager_id: ObjectIdSchema,
  owner: SuiAddressSchema,
  executor: SuiAddressSchema,
  quote_asset: z.string(),
  oracle_id: ObjectIdSchema,
  expiry: IntegerishDtoSchema,
  strike: IntegerishDtoSchema,
  is_up: z.boolean(),
  quantity: IntegerishDtoSchema,
  payout: IntegerishDtoSchema,
  bid_price: IntegerishDtoSchema.optional(),
  is_settled: z.boolean(),
}).passthrough();

const RangeMintHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  manager_id: ObjectIdSchema,
  trader: SuiAddressSchema,
  quote_asset: z.string(),
  oracle_id: ObjectIdSchema,
  expiry: IntegerishDtoSchema,
  lower_strike: IntegerishDtoSchema,
  higher_strike: IntegerishDtoSchema,
  quantity: IntegerishDtoSchema,
  cost: IntegerishDtoSchema,
  ask_price: IntegerishDtoSchema.optional(),
}).passthrough();

const RangeRedeemHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  manager_id: ObjectIdSchema,
  trader: SuiAddressSchema,
  quote_asset: z.string(),
  oracle_id: ObjectIdSchema,
  expiry: IntegerishDtoSchema,
  lower_strike: IntegerishDtoSchema,
  higher_strike: IntegerishDtoSchema,
  quantity: IntegerishDtoSchema,
  payout: IntegerishDtoSchema,
  bid_price: IntegerishDtoSchema.optional(),
  is_settled: z.boolean(),
}).passthrough();

const LpSupplyHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  supplier: SuiAddressSchema,
  quote_asset: z.string(),
  amount: IntegerishDtoSchema,
  shares_minted: IntegerishDtoSchema,
}).passthrough();

const LpWithdrawalHistoryRecordDtoSchema = IndexedEventBaseDtoSchema.extend({
  predict_id: ObjectIdSchema,
  withdrawer: SuiAddressSchema,
  quote_asset: z.string(),
  amount: IntegerishDtoSchema,
  shares_burned: IntegerishDtoSchema,
}).passthrough();

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

export const OracleSummaryDtoSchema = z
  .object({
    predict_id: ObjectIdSchema,
    oracle_id: ObjectIdSchema,
    oracle_cap_id: ObjectIdSchema,
    underlying_asset: z.string(),
    expiry: IntegerishDtoSchema,
    min_strike: IntegerishDtoSchema,
    tick_size: IntegerishDtoSchema,
    status: z.string(),
    activated_at: IntegerishDtoSchema.nullable(),
    settlement_price: IntegerishDtoSchema.nullable(),
    settled_at: IntegerishDtoSchema.nullable(),
    created_checkpoint: IntegerishDtoSchema,
  })
  .passthrough();

export const OraclePriceUpdateDtoSchema = z
  .object({
    event_digest: z.string(),
    digest: z.string(),
    sender: SuiAddressSchema,
    checkpoint: IntegerishDtoSchema,
    checkpoint_timestamp_ms: IntegerishDtoSchema,
    tx_index: z.number().int().nonnegative(),
    event_index: z.number().int().nonnegative(),
    package: z.string(),
    oracle_id: ObjectIdSchema,
    spot: IntegerishDtoSchema,
    forward: IntegerishDtoSchema,
    onchain_timestamp: IntegerishDtoSchema,
  })
  .passthrough();

export const OracleSviUpdateDtoSchema = z
  .object({
    event_digest: z.string(),
    digest: z.string(),
    sender: SuiAddressSchema,
    checkpoint: IntegerishDtoSchema,
    checkpoint_timestamp_ms: IntegerishDtoSchema,
    tx_index: z.number().int().nonnegative(),
    event_index: z.number().int().nonnegative(),
    package: z.string(),
    oracle_id: ObjectIdSchema,
    a: IntegerishDtoSchema,
    b: IntegerishDtoSchema,
    rho: IntegerishDtoSchema,
    rho_negative: z.boolean(),
    m: IntegerishDtoSchema,
    m_negative: z.boolean(),
    sigma: IntegerishDtoSchema,
    onchain_timestamp: IntegerishDtoSchema,
  })
  .passthrough();

export const PredictStateDtoSchema = z
  .object({
    predict_id: ObjectIdSchema,
    pricing: z.unknown().nullable(),
    risk: z.unknown().nullable(),
    trading_paused: z.boolean().nullable(),
    quote_assets: z.array(z.string()),
  })
  .passthrough();
export const PredictOraclesDtoSchema = z.array(OracleSummaryDtoSchema);
export const OracleStateDtoSchema = z
  .object({
    oracle: OracleSummaryDtoSchema,
    latest_price: OraclePriceUpdateDtoSchema.nullable(),
    latest_svi: OracleSviUpdateDtoSchema.nullable(),
    ask_bounds: z.union([UnknownObjectDtoSchema, z.null()]),
  })
  .passthrough();
export const QuoteAssetsDtoSchema = UnknownListDtoSchema;
export const OracleAskBoundsDtoSchema = z.union([UnknownObjectDtoSchema, z.null()]);
export const VaultSummaryDtoSchema = z
  .object({
    predict_id: ObjectIdSchema,
    quote_assets: z.array(z.string()),
    vault_balance: IntegerishDtoSchema,
    vault_value: IntegerishDtoSchema,
    total_mtm: IntegerishDtoSchema,
    total_max_payout: IntegerishDtoSchema,
    available_liquidity: IntegerishDtoSchema,
    available_withdrawal: IntegerishDtoSchema,
    plp_total_supply: IntegerishDtoSchema,
    plp_share_price: NumberishDtoSchema,
    utilization: NumberishDtoSchema,
    max_payout_utilization: NumberishDtoSchema,
    net_deposits: IntegerishDtoSchema,
    total_supplied: IntegerishDtoSchema,
    total_withdrawn: IntegerishDtoSchema,
  })
  .passthrough();
export const VaultPerformanceDtoSchema = z
  .object({
    predict_id: ObjectIdSchema,
    range: z.literal('ALL'),
    points: z.array(VaultPerformancePointDtoSchema),
  })
  .passthrough();
export const ManagersDtoSchema = z.array(
  IndexedEventBaseDtoSchema.extend({
    manager_id: ObjectIdSchema,
    owner: SuiAddressSchema,
  }).passthrough(),
);
export const ManagerSummaryDtoSchema = z
  .object({
    manager_id: ObjectIdSchema,
    owner: SuiAddressSchema,
    balances: z.array(QuoteBalanceDtoSchema),
    trading_balance: IntegerishDtoSchema,
    open_exposure: IntegerishDtoSchema,
    redeemable_value: IntegerishDtoSchema,
    realized_pnl: IntegerishDtoSchema,
    unrealized_pnl: IntegerishDtoSchema,
    account_value: IntegerishDtoSchema,
    open_positions: z.number().int().nonnegative(),
    awaiting_settlement_positions: z.number().int().nonnegative(),
  })
  .passthrough();
export const ManagerPositionsSummaryDtoSchema = z.array(ManagerPositionSummaryRowDtoSchema);
export const ManagerPnlDtoSchema = z.union([
  z.array(ManagerPnlPointDtoSchema),
  z
    .object({
      manager_id: ObjectIdSchema,
      range: z.literal('ALL'),
      series_type: z.string(),
      current_total_pnl: IntegerishDtoSchema,
      current_unrealized_pnl: IntegerishDtoSchema,
      points: z.array(ManagerPnlPointDtoSchema),
    })
    .passthrough(),
]);
export const OraclePricesDtoSchema = UnknownListDtoSchema;
export const OracleLatestPriceDtoSchema = UnknownObjectDtoSchema;
export const OracleSviDtoSchema = UnknownListDtoSchema;
export const OracleLatestSviDtoSchema = UnknownObjectDtoSchema;
export const PositionMintHistoryDtoSchema = z.array(BinaryMintHistoryRecordDtoSchema);
export const PositionRedeemHistoryDtoSchema = z.array(BinaryRedeemHistoryRecordDtoSchema);
export const RangeMintHistoryDtoSchema = z.array(RangeMintHistoryRecordDtoSchema);
export const RangeRedeemHistoryDtoSchema = z.array(RangeRedeemHistoryRecordDtoSchema);
export const LpSuppliesHistoryDtoSchema = z.array(LpSupplyHistoryRecordDtoSchema);
export const LpWithdrawalsHistoryDtoSchema = z.array(LpWithdrawalHistoryRecordDtoSchema);
export const OracleTradesDtoSchema = z.array(IndexedEventBaseDtoSchema);

export type ObjectIdDto = z.infer<typeof ObjectIdSchema>;
export type SuiAddressDto = z.infer<typeof SuiAddressSchema>;
export type MoveTypeDto = z.infer<typeof MoveTypeSchema>;
export type StatusQuery = z.infer<typeof StatusQuerySchema>;
export type PathPredictId = z.infer<typeof PathPredictIdSchema>;
export type PathOracleId = z.infer<typeof PathOracleIdSchema>;
export type PathManagerId = z.infer<typeof PathManagerIdSchema>;
export type RangeQueryVerified = z.infer<typeof RangeQueryVerifiedSchema>;
export type PredictServerStatusDto = z.infer<typeof PredictServerStatusDtoSchema>;
export type OracleSummaryDto = z.infer<typeof OracleSummaryDtoSchema>;
export type OraclePriceUpdateDto = z.infer<typeof OraclePriceUpdateDtoSchema>;
export type OracleSviUpdateDto = z.infer<typeof OracleSviUpdateDtoSchema>;
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
