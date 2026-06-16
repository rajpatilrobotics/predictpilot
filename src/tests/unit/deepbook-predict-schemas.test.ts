import { describe, expect, it } from 'vitest';
import {
  ManagerPnlDtoSchema,
  ManagerPositionsSummaryDtoSchema,
  ManagerSummaryDtoSchema,
  ObjectIdSchema,
  PathOracleIdSchema,
  PositionMintHistoryDtoSchema,
  PredictOraclesDtoSchema,
  PredictServerStatusDtoSchema,
  PredictStateDtoSchema,
  RangeQueryVerifiedSchema,
  VaultPerformanceDtoSchema,
  VaultSummaryDtoSchema,
} from '@/integrations/deepbook-predict/schemas';

const validObjectId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const validOracleSummaryFixture = {
  predict_id: validObjectId,
  oracle_id: validObjectId,
  oracle_cap_id: validObjectId,
  underlying_asset: 'BTC',
  expiry: 1_781_641_800_000,
  min_strike: 50_000_000_000_000,
  tick_size: 1_000_000_000,
  status: 'active',
  activated_at: 1_781_634_686_445,
  settlement_price: null,
  settled_at: null,
  created_checkpoint: 349_219_640,
};

const validStatusFixture = {
  status: 'OK',
  latest_onchain_checkpoint: 100,
  current_time_ms: 1_800_000_000_000,
  earliest_checkpoint: 50,
  max_lag_pipeline: 'oracle_prices',
  pipelines: [
    {
      pipeline: 'oracle_prices',
      indexed_checkpoint: 99,
      indexed_epoch: 10,
      indexed_timestamp_ms: 1_800_000_000_000,
      checkpoint_lag: 1,
      time_lag_seconds: 2,
      latest_onchain_checkpoint: 100,
    },
  ],
  max_checkpoint_lag: 1,
  max_time_lag_seconds: 2,
};

const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';
const eventBase = {
  event_digest: 'event',
  digest: 'digest',
  sender,
  checkpoint: 1,
  checkpoint_timestamp_ms: 1_781_635_075_310,
  tx_index: 0,
  event_index: 0,
  package: 'f5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
};

describe('DeepBook Predict schemas', () => {
  it('parses a verified Predict server status response', () => {
    const parsed = PredictServerStatusDtoSchema.safeParse(validStatusFixture);

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid Predict server status values', () => {
    const parsed = PredictServerStatusDtoSchema.safeParse({
      ...validStatusFixture,
      status: 'DEGRADED',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects status pipeline rows missing required fields', () => {
    const parsed = PredictServerStatusDtoSchema.safeParse({
      ...validStatusFixture,
      pipelines: [{ pipeline: 'oracle_prices' }],
    });

    expect(parsed.success).toBe(false);
  });

  it('validates Sui object IDs and path params', () => {
    expect(ObjectIdSchema.safeParse(validObjectId).success).toBe(true);
    expect(ObjectIdSchema.safeParse('0xnot-valid').success).toBe(false);

    expect(PathOracleIdSchema.safeParse({ oracleId: validObjectId }).success).toBe(true);
    expect(PathOracleIdSchema.safeParse({ oracleId: '0xnot-valid' }).success).toBe(false);
  });

  it('accepts only the verified ALL range query value', () => {
    expect(RangeQueryVerifiedSchema.safeParse({ range: 'ALL' }).success).toBe(true);
    expect(RangeQueryVerifiedSchema.safeParse({ range: 'DAY' }).success).toBe(false);
  });

  it('validates captured PP-010 object payloads while preserving unknown nested fields', () => {
    expect(
      ManagerSummaryDtoSchema.safeParse({
        account_value: 0,
        awaiting_settlement_positions: 0,
        balances: [{ balance: 0, quote_asset: quoteAsset }],
        manager_id: validObjectId,
        open_exposure: 0,
        open_positions: 0,
        owner: validObjectId,
        realized_pnl: 0,
        redeemable_value: 0,
        trading_balance: 0,
        unexpected_future_field: { still: 'allowed' },
        unrealized_pnl: 0,
      }).success,
    ).toBe(true);
    expect(ManagerSummaryDtoSchema.safeParse({ any_field: { nested: true } }).success).toBe(false);
    expect(PredictStateDtoSchema.safeParse([]).success).toBe(false);
  });

  it('validates captured list payloads and rejects non-lists', () => {
    expect(PredictOraclesDtoSchema.safeParse([validOracleSummaryFixture]).success).toBe(true);
    expect(
      ManagerPositionsSummaryDtoSchema.safeParse([
        {
          average_entry_price: 510224061,
          average_exit_price: null,
          expiry: 1_781_647_200_000,
          first_minted_at: 1_781_635_254_964,
          is_up: true,
          last_activity_at: 1_781_635_254_964,
          manager_id: validObjectId,
          mark_price: 583732499,
          mark_value: 25_011_051,
          minted_quantity: 42_846_768,
          open_cost_basis: 21_861_452,
          open_quantity: 42_846_768,
          oracle_id: validObjectId,
          predict_id: validObjectId,
          quote_asset: quoteAsset,
          realized_pnl: 0,
          redeemed_quantity: 0,
          status: 'active',
          strike: 65_751_000_000_000,
          total_cost: 21_861_452,
          total_payout: 0,
          underlying_asset: 'BTC',
          unrealized_pnl: 3_149_599,
        },
      ]).success,
    ).toBe(true);
    expect(PredictOraclesDtoSchema.safeParse({ oracle_id: validObjectId }).success).toBe(false);
  });

  it('validates captured vault and history payloads', () => {
    expect(
      VaultSummaryDtoSchema.safeParse({
        available_liquidity: 1,
        available_withdrawal: 1,
        max_payout_utilization: 0.1,
        net_deposits: 1,
        plp_share_price: 1,
        plp_total_supply: 1,
        predict_id: validObjectId,
        quote_assets: [quoteAsset],
        total_max_payout: 1,
        total_mtm: 1,
        total_supplied: 1,
        total_withdrawn: 0,
        utilization: 0.1,
        vault_balance: 1,
        vault_value: 1,
      }).success,
    ).toBe(true);
    expect(
      VaultPerformanceDtoSchema.safeParse({
        points: [{ share_price: 1, timestamp_ms: 1_781_635_075_310, total_shares: 1, vault_value: 1 }],
        predict_id: validObjectId,
        range: 'ALL',
      }).success,
    ).toBe(true);
    expect(
      PositionMintHistoryDtoSchema.safeParse([
        {
          ...eventBase,
          ask_price: 510224076,
          cost: 21_861_452,
          expiry: 1_781_647_200_000,
          is_up: true,
          manager_id: validObjectId,
          oracle_id: validObjectId,
          predict_id: validObjectId,
          quantity: 42_846_768,
          quote_asset: quoteAsset,
          strike: 65_751_000_000_000,
          trader: sender,
        },
      ]).success,
    ).toBe(true);
  });

  it('accepts object or list PnL payloads using captured PnL point fields', () => {
    expect(ManagerPnlDtoSchema.safeParse([{ cumulative_realized_pnl: '1000000', timestamp_ms: 1 }]).success).toBe(
      true,
    );
    expect(
      ManagerPnlDtoSchema.safeParse({
        current_total_pnl: '1000000',
        current_unrealized_pnl: '0',
        manager_id: validObjectId,
        points: [{ cumulative_realized_pnl: '1000000', timestamp_ms: 1 }],
        range: 'ALL',
        series_type: 'realized',
      }).success,
    ).toBe(true);
    expect(ManagerPnlDtoSchema.safeParse('1000000').success).toBe(false);
  });
});
