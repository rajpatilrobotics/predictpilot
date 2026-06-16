import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import { usePredictState } from '@/features/markets/hooks/usePredictState';
import type { MarketReadClient } from '@/integrations/deepbook-predict/api/markets';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { HttpClientError } from '@/lib/http';
import type { ObjectId } from '@/types/predict';

const predictId = predictDeploymentConfig.predictObjectId;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const oracleCapId = '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817';

const oracleFixture = {
  activated_at: 1_781_634_686_445,
  created_checkpoint: 349_219_640,
  expiry: 1_781_641_800_000,
  min_strike: 50_000_000_000_000,
  oracle_cap_id: oracleCapId,
  oracle_id: oracleId,
  predict_id: predictId,
  settlement_price: null,
  settled_at: null,
  status: 'active',
  tick_size: 1_000_000_000,
  underlying_asset: 'BTC',
};

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });

  function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return TestQueryProvider;
}

function createMarketClient(overrides: Partial<MarketReadClient> = {}): MarketReadClient {
  return {
    fetchPredictOraclesDto: vi.fn(),
    fetchPredictStateDto: vi.fn(),
    ...overrides,
  };
}

function createOracleClient(overrides: Partial<OracleReadClient> = {}): OracleReadClient {
  return {
    fetchOracleAskBoundsDto: vi.fn(),
    fetchOracleStateDto: vi.fn(),
    ...overrides,
  };
}

describe('market intelligence query hooks', () => {
  it('loads Predict state through the default deployment Predict ID', async () => {
    const client = createMarketClient({
      fetchPredictStateDto: vi.fn().mockResolvedValue({
        predict_id: predictId,
        pricing: null,
        quote_assets: [
          'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
        ],
        risk: { paused: false },
        trading_paused: null,
      }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictState({ client }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchPredictStateDto).toHaveBeenCalledWith(predictId);
    expect(result.current.data).toMatchObject({
      predictId,
      pricingStatus: 'MISSING',
      riskStatus: 'PRESENT',
      tradingPaused: null,
    });
    expect(result.current.data?.quoteAssets).toEqual([
      '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
    ]);
  });

  it('loads Predict oracle summaries through the market query key path', async () => {
    const client = createMarketClient({
      fetchPredictOraclesDto: vi.fn().mockResolvedValue([oracleFixture]),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictOracles({ client, predictId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchPredictOraclesDto).toHaveBeenCalledWith(predictId);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      oracleId,
      predictId,
      underlyingAsset: 'BTC',
    });
    expect(result.current.data?.[0]?.expiryMs).toBe(1_781_641_800_000n);
  });

  it('loads selected oracle state through the oracle query key path', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue({
        ask_bounds: null,
        latest_price: null,
        latest_svi: null,
        oracle: oracleFixture,
      }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useOracleState({ client, oracleId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchOracleStateDto).toHaveBeenCalledWith(oracleId);
    expect(result.current.data).toMatchObject({
      askBounds: { status: 'UNAVAILABLE' },
      latestPrice: null,
      latestSvi: null,
      oracle: {
        lifecycleStatus: 'ACTIVE',
        oracleId,
      },
    });
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createMarketClient({
      fetchPredictStateDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'timeout',
          message: 'Predict server timed out',
          url: 'https://predict-server.testnet.mystenlabs.com/status',
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictState({ client }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        predictId,
        query: 'predict-state',
      },
      kind: 'transport',
    });
  });

  it('does not call the adapter client when disabled', () => {
    const client = createOracleClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useOracleState({
          client,
          enabled: false,
          oracleId,
        }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.fetchOracleStateDto).not.toHaveBeenCalled();
  });
});
