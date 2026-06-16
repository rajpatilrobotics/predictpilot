import { describe, expect, it } from 'vitest';
import {
  ManagerPnlDtoSchema,
  ManagerSummaryDtoSchema,
  ObjectIdSchema,
  PathOracleIdSchema,
  PredictOraclesDtoSchema,
  PredictServerStatusDtoSchema,
  PredictStateDtoSchema,
  RangeQueryVerifiedSchema,
  VaultPerformanceDtoSchema,
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

  it('keeps unverified object payloads permissive until exact fields are captured', () => {
    expect(ManagerSummaryDtoSchema.safeParse({ any_field: { nested: true } }).success).toBe(true);
    expect(PredictStateDtoSchema.safeParse([]).success).toBe(false);
  });

  it('keeps unverified list payloads permissive but rejects non-lists', () => {
    expect(PredictOraclesDtoSchema.safeParse([validOracleSummaryFixture]).success).toBe(true);
    expect(VaultPerformanceDtoSchema.safeParse([{ vault_value: '1000000' }]).success).toBe(true);
    expect(PredictOraclesDtoSchema.safeParse({ oracle_id: validObjectId }).success).toBe(false);
  });

  it('accepts either object or list PnL payloads while the shape remains TODO VERIFY', () => {
    expect(ManagerPnlDtoSchema.safeParse([{ pnl: '1000000' }]).success).toBe(true);
    expect(ManagerPnlDtoSchema.safeParse({ points: [{ pnl: '1000000' }] }).success).toBe(true);
    expect(ManagerPnlDtoSchema.safeParse('1000000').success).toBe(false);
  });
});
