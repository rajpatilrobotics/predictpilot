import { describe, expect, it, vi } from 'vitest';
import { createAppLogger, sanitizeTelemetryMetadata } from '@/lib/logger';

function createConsoleLike() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('telemetry-safe logger', () => {
  it('redacts secret-like metadata keys and nested values', () => {
    const sanitized = sanitizeTelemetryMetadata({
      nested: {
        authToken: 'token-value',
        list: [
          {
            mnemonic: 'seed words',
          },
        ],
      },
      privateKey: 'private-key-value',
      seedPhrase: 'one two three',
    });

    expect(sanitized).toEqual({
      nested: {
        authToken: '[redacted]',
        list: [
          {
            mnemonic: '[redacted]',
          },
        ],
      },
      privateKey: '[redacted]',
      seedPhrase: '[redacted]',
    });
  });

  it('preserves harmless endpoint, object ID, and digest fields', () => {
    const sanitized = sanitizeTelemetryMetadata({
      digest: '9xDigest',
      endpoint: '/oracles/0xabc/state',
      managerId: '0xmanager',
      oracleId: '0xoracle',
    });

    expect(sanitized).toEqual({
      digest: '9xDigest',
      endpoint: '/oracles/0xabc/state',
      managerId: '0xmanager',
      oracleId: '0xoracle',
    });
  });

  it('does not expose raw stack traces from Error instances or stack fields', () => {
    const error = new Error('Predict server failed');
    const sanitized = sanitizeTelemetryMetadata({
      error,
      stack: 'Error: boom\n at secret frame',
    });

    expect(sanitized).toEqual({
      error: {
        message: 'Predict server failed',
        name: 'Error',
      },
      stack: '[redacted]',
    });
  });

  it('redacts secret-like string values even under harmless keys', () => {
    const sanitized = sanitizeTelemetryMetadata({
      note: 'stored in .env.local',
      path: 'playwright/.auth/user.json',
    });

    expect(sanitized).toEqual({
      note: '[redacted]',
      path: '[redacted]',
    });
  });

  it('emits sanitized dev logs through the selected level', () => {
    const consoleLike = createConsoleLike();
    const logger = createAppLogger({
      consoleLike,
      enabled: true,
    });

    logger.warn('predict.request_failed', {
      endpoint: '/status',
      privateKey: 'abc',
    });

    expect(consoleLike.warn).toHaveBeenCalledTimes(1);
    expect(consoleLike.warn).toHaveBeenCalledWith('[PredictPilot]', {
      eventName: 'predict.request_failed',
      metadata: {
        endpoint: '/status',
        privateKey: '[redacted]',
      },
    });
    expect(consoleLike.info).not.toHaveBeenCalled();
    expect(consoleLike.error).not.toHaveBeenCalled();
  });

  it('does not emit console logs when disabled for production', () => {
    const consoleLike = createConsoleLike();
    const logger = createAppLogger({
      consoleLike,
      enabled: false,
    });

    logger.info('predict.noop', {
      endpoint: '/status',
    });
    logger.warn('predict.noop', {
      endpoint: '/status',
    });
    logger.error('predict.noop', {
      endpoint: '/status',
    });

    expect(consoleLike.info).not.toHaveBeenCalled();
    expect(consoleLike.warn).not.toHaveBeenCalled();
    expect(consoleLike.error).not.toHaveBeenCalled();
  });
});
