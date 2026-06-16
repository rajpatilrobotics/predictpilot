import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { HttpClientError } from '@/lib/http';
import type { ObjectId } from '@/types/predict';

const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;

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

describe('useAskBounds', () => {
  it('loads unavailable ask bounds', async () => {
    const client = createOracleClient({
      fetchOracleAskBoundsDto: vi.fn().mockResolvedValue(null),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useAskBounds({ client, oracleId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchOracleAskBoundsDto).toHaveBeenCalledWith(oracleId);
    expect(result.current.data).toEqual({ status: 'UNAVAILABLE' });
  });

  it('loads present-but-unmapped ask bounds without inventing fields', async () => {
    const client = createOracleClient({
      fetchOracleAskBoundsDto: vi.fn().mockResolvedValue({ lower: 1, upper: 2 }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useAskBounds({ client, oracleId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: 'PRESENT_UNMAPPED' });
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createOracleClient({
      fetchOracleAskBoundsDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'validation',
          message: 'Predict server response changed',
          url: `https://predict-server.testnet.mystenlabs.com/oracles/${oracleId}/ask-bounds`,
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useAskBounds({ client, oracleId }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'EXTERNAL_API_SHAPE_CHANGED',
      context: {
        oracleId,
        query: 'oracle-ask-bounds',
      },
      kind: 'external-api',
    });
  });

  it('does not call the adapter client when disabled', () => {
    const client = createOracleClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () =>
        useAskBounds({
          client,
          enabled: false,
          oracleId,
        }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.fetchOracleAskBoundsDto).not.toHaveBeenCalled();
  });
});
