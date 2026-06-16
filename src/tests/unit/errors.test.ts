import { describe, expect, it } from 'vitest';
import { PredictAdapterError } from '@/integrations/deepbook-predict/api/mapping';
import {
  insufficientManagerDusdcError,
  insufficientWalletDusdcError,
  invalidRangeError,
  normalizeAppError,
  staleOracleError,
  todoVerifyPathError,
  wrongNetworkError,
} from '@/lib/errors';
import { HttpClientError } from '@/lib/http';

const endpoint = 'https://predict-server.testnet.mystenlabs.com/status';

describe('app error normalization', () => {
  it('maps HTTP validation failures to external API shape errors', () => {
    const normalized = normalizeAppError(
      new HttpClientError({
        kind: 'validation',
        message: 'schema failed',
        url: endpoint,
      }),
    );

    expect(normalized).toMatchObject({
      code: 'EXTERNAL_API_SHAPE_CHANGED',
      kind: 'external-api',
      retryable: true,
      title: 'Predict data changed',
    });
    expect(normalized.context).toMatchObject({ url: endpoint });
  });

  it('maps timeout, network, and HTTP 5xx errors to retryable Predict server errors', () => {
    for (const error of [
      new HttpClientError({ kind: 'timeout', message: 'timeout', url: endpoint }),
      new HttpClientError({ kind: 'network', message: 'network', url: endpoint }),
      new HttpClientError({ kind: 'http-status', message: 'server', status: 503, url: endpoint }),
    ]) {
      const normalized = normalizeAppError(error);

      expect(normalized).toMatchObject({
        code: 'PREDICT_SERVER_UNAVAILABLE',
        retryable: true,
      });
    }
  });

  it('maps HTTP 4xx errors to non-retryable request errors', () => {
    const normalized = normalizeAppError(
      new HttpClientError({
        kind: 'http-status',
        message: 'bad request',
        status: 404,
        url: endpoint,
      }),
    );

    expect(normalized).toMatchObject({
      code: 'PREDICT_SERVER_REQUEST_FAILED',
      retryable: false,
      severity: 'error',
    });
  });

  it('maps Predict adapter errors to external shape failures', () => {
    const normalized = normalizeAppError(new PredictAdapterError('Expected a Move type'));

    expect(normalized.code).toBe('EXTERNAL_API_SHAPE_CHANGED');
    expect(normalized.context).toEqual({
      adapterError: 'Expected a Move type',
    });
  });

  it('maps wallet rejection-like errors to transaction rejected', () => {
    const normalized = normalizeAppError(new Error('User rejected the request in wallet'));

    expect(normalized).toMatchObject({
      code: 'TRANSACTION_REJECTED',
      kind: 'wallet',
      retryable: true,
      title: 'Wallet rejected request',
    });
  });

  it('creates specific protocol and precondition errors with recovery copy', () => {
    expect(wrongNetworkError('mainnet')).toMatchObject({
      code: 'WRONG_NETWORK',
      context: { actualNetwork: 'mainnet', expectedNetwork: 'testnet' },
      severity: 'critical',
    });
    expect(staleOracleError({ oracleId: '0xoracle' })).toMatchObject({
      code: 'ORACLE_STALE',
      recovery: 'Refresh oracle state before previewing or signing a transaction.',
    });
    expect(invalidRangeError()).toMatchObject({
      code: 'INVALID_RANGE',
      recovery: 'Choose a lower strike that is below the higher strike.',
    });
    expect(insufficientManagerDusdcError()).toMatchObject({
      code: 'INSUFFICIENT_MANAGER_DUSDC',
      title: 'Manager balance too low',
    });
    expect(insufficientWalletDusdcError()).toMatchObject({
      code: 'INSUFFICIENT_WALLET_DUSDC',
      title: 'Wallet balance too low',
    });
    expect(todoVerifyPathError()).toMatchObject({
      code: 'TODO_VERIFY_PATH_USED',
      severity: 'critical',
    });
  });

  it('maps unknown thrown values without exposing raw objects', () => {
    const normalized = normalizeAppError({
      privateKey: 'do-not-leak',
      raw: 'untrusted-object',
    });

    expect(normalized).toMatchObject({
      code: 'UNKNOWN_ERROR',
      title: 'Unexpected error',
    });
    expect(normalized.message).not.toContain('do-not-leak');
    expect(normalized.message).not.toContain('untrusted-object');
    expect(normalized.debugId).toMatch(/^pp-unknown-error-/);
  });

  it('sanitizes supplied context before returning UI-safe errors', () => {
    const normalized = normalizeAppError(new Error('boom'), {
      context: {
        endpoint: '/status',
        privateKey: 'abc',
      },
    });

    expect(normalized.context).toEqual({
      endpoint: '/status',
      errorName: 'Error',
      privateKey: '[redacted]',
    });
  });
});
