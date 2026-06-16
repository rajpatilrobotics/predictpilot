import { describe, expect, it } from 'vitest';
import { defaultPublicRuntimeEnv, parseRuntimeEnv } from '@/config/env';

describe('parseRuntimeEnv', () => {
  it('loads a valid Vite environment into typed runtime config', () => {
    const config = parseRuntimeEnv(defaultPublicRuntimeEnv);

    expect(config.suiNetwork).toBe('testnet');
    expect(config.predictQuoteDecimals).toBe(6);
    expect(config.defaultOracleId).toBeUndefined();
  });

  it('rejects invalid public URLs', () => {
    expect(() =>
      parseRuntimeEnv({
        ...defaultPublicRuntimeEnv,
        VITE_PREDICT_SERVER_URL: 'not-a-url',
      }),
    ).toThrow();
  });

  it('rejects missing production values instead of silently guessing', () => {
    expect(() => parseRuntimeEnv({ PROD: true })).toThrow();
  });
});
