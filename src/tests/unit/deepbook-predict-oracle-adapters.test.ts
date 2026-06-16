import { describe, expect, it, vi } from 'vitest';
import { getAskBounds, getOracleState } from '@/integrations/deepbook-predict/api/oracles';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d';
const packageId = 'f5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
const sender = '0xcca26f7ae2e40604498294e95bacccc4652cc8cb2aa074d7ee608c7e7bdf0c29';

const oracleFixture = {
  predict_id: predictId,
  oracle_id: oracleId,
  oracle_cap_id: '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817',
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

const priceFixture = {
  event_digest: 'price-event',
  digest: 'price',
  sender,
  checkpoint: 349_221_599,
  checkpoint_timestamp_ms: 1_781_635_075_310,
  tx_index: 6,
  event_index: 17,
  package: packageId,
  oracle_id: oracleId,
  spot: 65_779_964_623_839,
  forward: 65_781_643_925_915,
  onchain_timestamp: 1_781_635_075_244,
};

const sviFixture = {
  event_digest: 'svi-event',
  digest: 'svi',
  sender,
  checkpoint: 349_221_548,
  checkpoint_timestamp_ms: 1_781_635_063_338,
  tx_index: 8,
  event_index: 35,
  package: packageId,
  oracle_id: oracleId,
  a: 14_141,
  b: 507_617,
  rho: 182_500_929,
  rho_negative: true,
  m: 1_197_052,
  m_negative: true,
  sigma: 1_655_314,
  onchain_timestamp: 1_781_635_063_338,
};

describe('oracle read adapters', () => {
  it('maps oracle state with latest price and SVI into an app-native model', async () => {
    const client: OracleReadClient = {
      fetchOracleAskBoundsDto: vi.fn(),
      fetchOracleStateDto: vi.fn().mockResolvedValue({
        ask_bounds: null,
        latest_price: priceFixture,
        latest_svi: sviFixture,
        oracle: oracleFixture,
      }),
    };

    const state = await getOracleState({ client, oracleId });

    expect(state.oracle.lifecycleStatus).toBe('ACTIVE');
    expect(state.latestPrice?.spot1e9).toBe(65_779_964_623_839n);
    expect(state.latestPrice?.packageId).toBe(`0x${packageId}`);
    expect(state.latestSvi?.svi.rho1e9Signed).toBe(-182_500_929n);
    expect(state.latestSvi?.svi.m1e9Signed).toBe(-1_197_052n);
    expect(state.askBounds).toEqual({ status: 'UNAVAILABLE' });
  });

  it('handles nullable latest price and SVI safely', async () => {
    const client: OracleReadClient = {
      fetchOracleAskBoundsDto: vi.fn(),
      fetchOracleStateDto: vi.fn().mockResolvedValue({
        ask_bounds: null,
        latest_price: null,
        latest_svi: null,
        oracle: oracleFixture,
      }),
    };

    const state = await getOracleState({ client, oracleId });

    expect(state.latestPrice).toBeNull();
    expect(state.latestSvi).toBeNull();
  });

  it('maps null ask bounds into an unavailable model', async () => {
    const client: OracleReadClient = {
      fetchOracleAskBoundsDto: vi.fn().mockResolvedValue(null),
      fetchOracleStateDto: vi.fn(),
    };

    await expect(getAskBounds({ client, oracleId })).resolves.toEqual({ status: 'UNAVAILABLE' });
  });

  it('maps present ask bounds into a present-but-unmapped model', async () => {
    const client: OracleReadClient = {
      fetchOracleAskBoundsDto: vi.fn().mockResolvedValue({ lower: 1, upper: 2 }),
      fetchOracleStateDto: vi.fn(),
    };

    await expect(getAskBounds({ client, oracleId })).resolves.toEqual({
      status: 'PRESENT_UNMAPPED',
    });
  });
});
