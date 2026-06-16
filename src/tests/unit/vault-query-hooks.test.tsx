import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { useVaultPerformance } from '@/features/vault/hooks/useVaultPerformance';
import { useVaultSummary } from '@/features/vault/hooks/useVaultSummary';
import type { VaultReadClient } from '@/integrations/deepbook-predict/api/vault';
import { HttpClientError } from '@/lib/http';

const predictId = predictDeploymentConfig.predictObjectId;
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

const vaultSummaryFixture = {
  available_liquidity: 1_013_621_323_890,
  available_withdrawal: 1_013_621_323_890,
  max_payout_utilization: 0.0020975390715985472,
  net_deposits: 1_013_136_152_701,
  plp_share_price: 1.0018485537482182,
  plp_total_supply: 1_013_114_841_700,
  predict_id: predictId,
  quote_assets: [quoteAsset],
  total_max_payout: 2_130_579_304,
  total_mtm: 764_264_256,
  total_supplied: 1_072_609_144_409,
  total_withdrawn: 59_472_991_708,
  utilization: 0.0007524123298187235,
  vault_balance: 1_015_751_903_194,
  vault_value: 1_014_987_638_938,
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

function createVaultClient(overrides: Partial<VaultReadClient> = {}): VaultReadClient {
  return {
    fetchVaultPerformanceDto: vi.fn(),
    fetchVaultSummaryDto: vi.fn(),
    ...overrides,
  };
}

describe('vault read query hooks', () => {
  it('loads vault summary with vault value, liquidity, utilization, and PLP context', async () => {
    const client = createVaultClient({
      fetchVaultSummaryDto: vi.fn().mockResolvedValue(vaultSummaryFixture),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useVaultSummary({ client }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchVaultSummaryDto).toHaveBeenCalledWith(predictId);
    expect(result.current.data).toMatchObject({
      availableLiquidityQuote: 1_013_621_323_890n,
      maxPayoutUtilizationRatio: 0.0020975390715985472,
      plpSharePrice: 1.0018485537482182,
      plpTotalSupplyAtomic: 1_013_114_841_700n,
      predictId,
      utilizationRatio: 0.0007524123298187235,
      vaultValueQuote: 1_014_987_638_938n,
    });
    expect(result.current.data?.quoteAssetType).toBe(`0x${quoteAsset}`);
  });

  it('loads populated vault performance series for the verified ALL range', async () => {
    const client = createVaultClient({
      fetchVaultPerformanceDto: vi.fn().mockResolvedValue({
        points: [
          {
            share_price: 1,
            timestamp_ms: 1_776_715_922_850,
            total_shares: 1_000_000_000_000,
            vault_value: 1_000_000_000_000,
          },
          {
            share_price: 1.01,
            timestamp_ms: 1_776_716_922_850,
            total_shares: 1_010_000_000_000,
            vault_value: 1_020_100_000_000,
          },
        ],
        predict_id: predictId,
        range: 'ALL',
      }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useVaultPerformance({ client }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchVaultPerformanceDto).toHaveBeenCalledWith(predictId, 'ALL');
    expect(result.current.data).toMatchObject({
      predictId,
      range: 'ALL',
    });
    expect(result.current.data?.points).toEqual([
      {
        sharePrice: 1,
        timestampMs: 1_776_715_922_850n,
        totalSharesAtomic: 1_000_000_000_000n,
        vaultValueQuote: 1_000_000_000_000n,
      },
      {
        sharePrice: 1.01,
        timestampMs: 1_776_716_922_850n,
        totalSharesAtomic: 1_010_000_000_000n,
        vaultValueQuote: 1_020_100_000_000n,
      },
    ]);
  });

  it('loads an empty vault performance series without treating it as an error', async () => {
    const client = createVaultClient({
      fetchVaultPerformanceDto: vi.fn().mockResolvedValue({
        points: [],
        predict_id: predictId,
        range: 'ALL',
      }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useVaultPerformance({ client }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      points: [],
      predictId,
      range: 'ALL',
    });
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createVaultClient({
      fetchVaultSummaryDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'http-status',
          message: 'Predict server unavailable',
          status: 503,
          url: `https://predict-server.testnet.mystenlabs.com/predicts/${predictId}/vault/summary`,
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useVaultSummary({ client }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        predictId,
        query: 'vault-summary',
      },
      kind: 'transport',
    });
  });

  it('does not call the adapter client when disabled', () => {
    const client = createVaultClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useVaultPerformance({ client, enabled: false }), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.fetchVaultPerformanceDto).not.toHaveBeenCalled();
  });
});
