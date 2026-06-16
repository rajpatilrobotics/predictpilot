import { describe, expect, it, vi } from 'vitest';
import { createPredictServerClient } from '@/integrations/deepbook-predict/client';
import type { FetchLike } from '@/lib/http';

const baseUrl = 'https://predict-server.testnet.mystenlabs.com';
const objectId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const statusFixture = {
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

const listPaths = new Set([
  `/predicts/${objectId}/oracles`,
  `/predicts/${objectId}/quote-assets`,
  `/predicts/${objectId}/vault/performance`,
  '/managers',
  `/oracles/${objectId}/prices`,
  `/oracles/${objectId}/svi`,
  '/positions/minted',
  '/positions/redeemed',
  '/ranges/minted',
  '/ranges/redeemed',
  '/lp/supplies',
  '/lp/withdrawals',
  `/trades/${objectId}`,
]);

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: {
        'content-type': 'application/json',
      },
      status: 200,
    }),
  );
}

function responseForPath(pathname: string) {
  if (pathname === '/status') {
    return jsonResponse(statusFixture);
  }

  if (listPaths.has(pathname)) {
    return jsonResponse([]);
  }

  return jsonResponse({});
}

function toUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}

describe('Predict server client', () => {
  it('builds documented endpoint paths and verified query params', async () => {
    const calledUrls: string[] = [];
    const fetchImpl = vi.fn<FetchLike>((input) => {
      const url = toUrl(input);
      calledUrls.push(`${url.pathname}${url.search}`);
      return responseForPath(url.pathname);
    });
    const client = createPredictServerClient({
      baseUrl,
      fetchImpl,
      retries: 0,
    });

    await client.fetchPredictServerStatus({ max_checkpoint_lag: 10 });
    await client.fetchPredictStateDto(objectId);
    await client.fetchPredictOraclesDto(objectId);
    await client.fetchPredictQuoteAssetsDto(objectId);
    await client.fetchOracleStateDto(objectId);
    await client.fetchOracleAskBoundsDto(objectId);
    await client.fetchVaultSummaryDto(objectId);
    await client.fetchVaultPerformanceDto(objectId);
    await client.fetchManagersDto();
    await client.fetchManagerSummaryDto(objectId);
    await client.fetchManagerPositionsSummaryDto(objectId);
    await client.fetchManagerPnlDto(objectId);
    await client.fetchOraclePricesDto(objectId);
    await client.fetchOracleLatestPriceDto(objectId);
    await client.fetchOracleSviDto(objectId);
    await client.fetchOracleLatestSviDto(objectId);
    await client.fetchPositionMintHistoryDto();
    await client.fetchPositionRedeemHistoryDto();
    await client.fetchRangeMintHistoryDto();
    await client.fetchRangeRedeemHistoryDto();
    await client.fetchLpSuppliesHistoryDto();
    await client.fetchLpWithdrawalsHistoryDto();
    await client.fetchOracleTradesDto(objectId);

    expect(calledUrls).toEqual([
      '/status?max_checkpoint_lag=10',
      `/predicts/${objectId}/state`,
      `/predicts/${objectId}/oracles`,
      `/predicts/${objectId}/quote-assets`,
      `/oracles/${objectId}/state`,
      `/oracles/${objectId}/ask-bounds`,
      `/predicts/${objectId}/vault/summary`,
      `/predicts/${objectId}/vault/performance?range=ALL`,
      '/managers',
      `/managers/${objectId}/summary`,
      `/managers/${objectId}/positions/summary`,
      `/managers/${objectId}/pnl?range=ALL`,
      `/oracles/${objectId}/prices`,
      `/oracles/${objectId}/prices/latest`,
      `/oracles/${objectId}/svi`,
      `/oracles/${objectId}/svi/latest`,
      '/positions/minted',
      '/positions/redeemed',
      '/ranges/minted',
      '/ranges/redeemed',
      '/lp/supplies',
      '/lp/withdrawals',
      `/trades/${objectId}`,
    ]);
  });

  it('rejects invalid object IDs before fetch is called', () => {
    const fetchImpl = vi.fn<FetchLike>();
    const client = createPredictServerClient({
      baseUrl,
      fetchImpl,
    });

    expect(() => client.fetchOracleStateDto('0xnot-valid')).toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not add an unverified owner filter to managers requests', async () => {
    const fetchImpl = vi.fn<FetchLike>((input) => {
      const url = toUrl(input);
      expect(url.pathname).toBe('/managers');
      expect(url.search).toBe('');
      return jsonResponse([]);
    });
    const client = createPredictServerClient({
      baseUrl,
      fetchImpl,
    });

    await expect(client.fetchManagersDto()).resolves.toEqual([]);
  });
});
