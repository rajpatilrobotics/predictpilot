import type { z } from 'zod';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type HttpQueryValue = boolean | number | string | null | undefined;
export type HttpQuery = Record<string, HttpQueryValue>;

export type HttpClientErrorKind =
  | 'http-status'
  | 'invalid-json'
  | 'network'
  | 'timeout'
  | 'validation';

export interface FetchJsonOptions<TData> {
  baseUrl: string;
  path: string;
  schema: z.ZodType<TData>;
  query?: HttpQuery;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retries?: number;
}

interface HttpClientErrorOptions {
  kind: HttpClientErrorKind;
  message: string;
  url: string;
  cause?: unknown;
  status?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;

export class HttpClientError extends Error {
  public readonly kind: HttpClientErrorKind;
  public readonly status?: number;
  public readonly url: string;

  public constructor(options: HttpClientErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'HttpClientError';
    this.kind = options.kind;
    this.status = options.status;
    this.url = options.url;
  }
}

export function buildUrl(baseUrl: string, path: string, query: HttpQuery = {}) {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

export async function fetchJson<TData>({
  baseUrl,
  path,
  schema,
  query,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
}: FetchJsonOptions<TData>): Promise<TData> {
  const url = buildUrl(baseUrl, path, query).toString();
  const maxAttempts = Math.max(1, retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchJsonOnce({
        fetchImpl,
        schema,
        timeoutMs,
        url,
      });
    } catch (error) {
      if (!shouldRetry(error, attempt, maxAttempts)) {
        throw error;
      }
    }
  }

  throw new HttpClientError({
    kind: 'network',
    message: 'Predict server request failed',
    url,
  });
}

async function fetchJsonOnce<TData>({
  fetchImpl,
  schema,
  timeoutMs,
  url,
}: {
  fetchImpl: FetchLike;
  schema: z.ZodType<TData>;
  timeoutMs: number;
  url: string;
}) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
      },
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpClientError({
        kind: 'http-status',
        message: `Predict server returned HTTP ${response.status}`,
        status: response.status,
        url,
      });
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (error) {
      throw new HttpClientError({
        cause: error,
        kind: 'invalid-json',
        message: 'Predict server returned invalid JSON',
        url,
      });
    }

    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      throw new HttpClientError({
        cause: parsed.error,
        kind: 'validation',
        message: 'Predict server response failed validation',
        url,
      });
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof HttpClientError) {
      throw error;
    }

    if (didTimeout) {
      throw new HttpClientError({
        cause: error,
        kind: 'timeout',
        message: 'Predict server request timed out',
        url,
      });
    }

    throw new HttpClientError({
      cause: error,
      kind: 'network',
      message: 'Predict server request failed before receiving a response',
      url,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(error: unknown, attempt: number, maxAttempts: number) {
  if (attempt >= maxAttempts) {
    return false;
  }

  if (!(error instanceof HttpClientError)) {
    return false;
  }

  if (error.kind === 'network') {
    return true;
  }

  return error.kind === 'http-status' && error.status !== undefined && error.status >= 500;
}
