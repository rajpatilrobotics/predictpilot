import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { useLiveOracleTape } from '@/features/oracle/hooks/useLiveOracleTape';
import {
  buildPredictOracleLiveEventTypes,
  getPredictOracleLiveEventMetadata,
  PREDICT_ORACLE_LIVE_EVENT_SUFFIXES,
} from '@/features/oracle/lib/live-oracle-events';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { HttpClientError } from '@/lib/http';
import type { ObjectId } from '@/types/predict';

const predictId = predictDeploymentConfig.predictObjectId;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const oracleCapId = '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';

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

function createOracleClient(overrides: Partial<OracleReadClient> = {}): OracleReadClient {
  return {
    fetchOracleAskBoundsDto: vi.fn(),
    fetchOracleStateDto: vi.fn(),
    ...overrides,
  };
}

function oracleStateDto({
  lifecycleStatus = 'active',
  priceTimestampMs = 1_781_635_254_000,
  settledAt = null,
  settlementPrice = null,
  sviTimestampMs = 1_781_635_250_000,
}: {
  lifecycleStatus?: string;
  priceTimestampMs?: number;
  settledAt?: number | null;
  settlementPrice?: number | null;
  sviTimestampMs?: number;
} = {}) {
  return {
    ask_bounds: null,
    latest_price: {
      checkpoint: 349_222_343,
      checkpoint_timestamp_ms: priceTimestampMs,
      digest: `price-digest-${priceTimestampMs}`,
      event_digest: `price-event-${priceTimestampMs}`,
      event_index: 0,
      forward: 65_500_000_000_000,
      onchain_timestamp: priceTimestampMs,
      oracle_id: oracleId,
      package: predictDeploymentConfig.packageId,
      sender,
      spot: 65_250_000_000_000,
      tx_index: 0,
    },
    latest_svi: {
      a: 100,
      b: 200,
      checkpoint: 349_222_344,
      checkpoint_timestamp_ms: sviTimestampMs,
      digest: `svi-digest-${sviTimestampMs}`,
      event_digest: `svi-event-${sviTimestampMs}`,
      event_index: 1,
      m: 400,
      m_negative: false,
      onchain_timestamp: sviTimestampMs,
      oracle_id: oracleId,
      package: predictDeploymentConfig.packageId,
      rho: 300,
      rho_negative: true,
      sender,
      sigma: 500,
      tx_index: 1,
    },
    oracle: {
      activated_at: 1_781_634_686_445,
      created_checkpoint: 349_219_640,
      expiry: 1_781_641_800_000,
      min_strike: 50_000_000_000_000,
      oracle_cap_id: oracleCapId,
      oracle_id: oracleId,
      predict_id: predictId,
      settlement_price: settlementPrice,
      settled_at: settledAt,
      status: lifecycleStatus,
      tick_size: 1_000_000_000,
      underlying_asset: 'BTC',
    },
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('live oracle tape metadata', () => {
  it('uses the configured package ID and verified event suffixes', () => {
    const metadata = getPredictOracleLiveEventMetadata();

    expect(metadata.packageId).toBe(predictDeploymentConfig.packageId);
    expect(metadata.eventTypeSuffixes).toEqual(PREDICT_ORACLE_LIVE_EVENT_SUFFIXES);
    expect(metadata.eventTypes).toEqual(
      buildPredictOracleLiveEventTypes(predictDeploymentConfig.packageId),
    );
    expect(metadata.eventTypes).toEqual([
      `${predictDeploymentConfig.packageId}::oracle::OraclePricesUpdated`,
      `${predictDeploymentConfig.packageId}::oracle::OracleSVIUpdated`,
      `${predictDeploymentConfig.packageId}::oracle::OracleSettled`,
      `${predictDeploymentConfig.packageId}::oracle::OracleActivated`,
    ]);
  });
});

describe('useLiveOracleTape', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not poll when disabled', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          enabled: false,
          oracleId,
          pollIntervalMs: 1,
        }),
      { wrapper },
    );

    await delay(20);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(client.fetchOracleStateDto).not.toHaveBeenCalled();
  });

  it('returns live tape data after the first successful poll', async () => {
    const nowMs = 1_781_635_255_000;
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          nowMs,
          oracleId,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.updateCount).toBe(1));
    expect(client.fetchOracleStateDto).toHaveBeenCalledWith(oracleId);
    expect(result.current.data).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      oracleId,
      pollIntervalMs: 3_000,
      source: 'PREDICT_SERVER_POLLING',
    });
    expect(result.current.data?.lastObservedPriceTimestampMs).toBe(1_781_635_254_000n);
    expect(result.current.data?.lastObservedSviTimestampMs).toBe(1_781_635_250_000n);
    expect(result.current.data?.freshness.aggregateStatus).toBe('FRESH');
  });

  it('increments update count when observed oracle freshness changes', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi
        .fn()
        .mockResolvedValueOnce(oracleStateDto())
        .mockResolvedValueOnce(
          oracleStateDto({
            priceTimestampMs: 1_781_635_256_000,
            sviTimestampMs: 1_781_635_256_000,
          }),
        )
        .mockResolvedValue(
          oracleStateDto({
            priceTimestampMs: 1_781_635_256_000,
            sviTimestampMs: 1_781_635_256_000,
          }),
        ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          nowMs: 1_781_635_257_000,
          oracleId,
          pollIntervalMs: 5,
        }),
      { wrapper },
    );

    await waitFor(() =>
      expect(vi.mocked(client.fetchOracleStateDto).mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await waitFor(() => expect(result.current.data?.updateCount).toBe(2));
    expect(result.current.data?.lastObservedPriceTimestampMs).toBe(1_781_635_256_000n);
  });

  it('does not fabricate tape updates when repeated polls are unchanged', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          nowMs: 1_781_635_257_000,
          oracleId,
          pollIntervalMs: 5,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.updateCount).toBe(1));
    await waitFor(() =>
      expect(vi.mocked(client.fetchOracleStateDto).mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    expect(result.current.data?.updateCount).toBe(1);
  });

  it('increments update count when lifecycle changes', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi
        .fn()
        .mockResolvedValueOnce(oracleStateDto())
        .mockResolvedValueOnce(
          oracleStateDto({
            lifecycleStatus: 'settled',
            settledAt: 1_781_641_900_000,
            settlementPrice: 66_000_000_000_000,
          }),
        )
        .mockResolvedValue(
          oracleStateDto({
            lifecycleStatus: 'settled',
            settledAt: 1_781_641_900_000,
            settlementPrice: 66_000_000_000_000,
          }),
        ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          nowMs: 1_781_641_901_000,
          oracleId,
          pollIntervalMs: 5,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.updateCount).toBe(2));
    expect(result.current.data?.lifecycleStatus).toBe('SETTLED');
    expect(result.current.data?.latestOracleState.oracle.settlementPrice1e9).toBe(
      66_000_000_000_000n,
    );
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'timeout',
          message: 'Predict server timed out',
          url: `https://predict-server.testnet.mystenlabs.com/oracles/${oracleId}/state`,
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useLiveOracleTape({
          client,
          oracleId,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        oracleId,
        query: 'live-oracle-tape',
        source: 'PREDICT_SERVER_POLLING',
      },
      kind: 'transport',
    });
  });
});
