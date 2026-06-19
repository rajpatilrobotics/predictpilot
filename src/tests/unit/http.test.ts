import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { buildUrl, fetchJson, type FetchLike } from '@/lib/http';

const baseUrl = 'https://predict-server.testnet.mystenlabs.com';
const objectSchema = z.object({ ok: z.literal(true) });

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

describe('http helpers', () => {
  it('builds URLs with encoded query params and skips empty values', () => {
    const url = buildUrl(baseUrl, '/status', {
      empty: null,
      max_checkpoint_lag: 10,
      max_time_lag_seconds: undefined,
      note: 'hello world',
    });

    expect(url.toString()).toBe(
      'https://predict-server.testnet.mystenlabs.com/status?max_checkpoint_lag=10&note=hello+world',
    );
  });

  it('returns schema-validated JSON responses', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ ok: true }));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        schema: objectSchema,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('throws HTTP errors for 4xx responses without retrying', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse({ error: 'not found' }, { status: 404 }));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/missing',
        retries: 2,
        schema: objectSchema,
      }),
    ).rejects.toMatchObject({
      kind: 'http-status',
      status: 404,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx responses before succeeding', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        retries: 1,
        schema: objectSchema,
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries network failures before succeeding', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        retries: 1,
        schema: objectSchema,
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws timeout errors when the request aborts after the timeout', async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        retries: 0,
        schema: objectSchema,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({
      kind: 'timeout',
    });
  });

  it('throws invalid-json errors for non-JSON responses', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response('not-json'));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        schema: objectSchema,
      }),
    ).rejects.toMatchObject({
      kind: 'invalid-json',
    });
  });

  it('throws validation errors when JSON does not match the schema', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ ok: false }));

    await expect(
      fetchJson({
        baseUrl,
        fetchImpl,
        path: '/status',
        schema: objectSchema,
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});
