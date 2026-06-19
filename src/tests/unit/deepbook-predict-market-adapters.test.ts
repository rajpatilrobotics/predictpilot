import { describe, expect, it, vi } from 'vitest';
import { getPredictOracles, getPredictState } from '@/integrations/deepbook-predict/api/markets';
import type { MarketReadClient } from '@/integrations/deepbook-predict/api/markets';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d';

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

describe('market read adapters', () => {
  it('maps Predict state into an app-native model and normalizes quote asset types', async () => {
    const client: MarketReadClient = {
      fetchPredictOraclesDto: vi.fn(),
      fetchPredictStateDto: vi.fn().mockResolvedValue({
        predict_id: predictId,
        pricing: null,
        risk: { paused: false },
        trading_paused: null,
        quote_assets: [
          'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
        ],
      }),
    };

    await expect(getPredictState({ client, predictId })).resolves.toEqual({
      predictId,
      pricingStatus: 'MISSING',
      quoteAssets: [
        '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
      ],
      riskStatus: 'PRESENT',
      tradingPaused: null,
    });
  });

  it('maps Predict oracle list DTOs into summary models', async () => {
    const client: MarketReadClient = {
      fetchPredictOraclesDto: vi.fn().mockResolvedValue([oracleFixture]),
      fetchPredictStateDto: vi.fn(),
    };

    const oracles = await getPredictOracles({ client, predictId });

    expect(oracles).toHaveLength(1);
    expect(oracles[0]).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      oracleId,
      predictId,
      underlyingAsset: 'BTC',
    });
    expect(oracles[0]?.expiryMs).toBe(1_781_641_800_000n);
  });

  it('maps live server created oracle status to inactive without failing the full market list', async () => {
    const client: MarketReadClient = {
      fetchPredictOraclesDto: vi.fn().mockResolvedValue([
        {
          ...oracleFixture,
          status: 'created',
        },
      ]),
      fetchPredictStateDto: vi.fn(),
    };

    const oracles = await getPredictOracles({ client, predictId });

    expect(oracles[0]?.lifecycleStatus).toBe('INACTIVE');
  });

  it('rejects unknown oracle lifecycle status instead of guessing', async () => {
    const client: MarketReadClient = {
      fetchPredictOraclesDto: vi.fn().mockResolvedValue([
        {
          ...oracleFixture,
          status: 'mysterious',
        },
      ]),
      fetchPredictStateDto: vi.fn(),
    };

    await expect(getPredictOracles({ client, predictId })).rejects.toThrow(
      /Unknown oracle lifecycle status/,
    );
  });
});
