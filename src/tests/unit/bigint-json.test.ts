import { describe, expect, it } from 'vitest';
import { installBigIntJsonSerialization } from '@/lib/bigint-json';

describe('installBigIntJsonSerialization', () => {
  it('serializes bigint values as decimal strings for JSON tooling', () => {
    installBigIntJsonSerialization();

    expect(JSON.stringify({ amount: 2_370_671n })).toBe('{"amount":"2370671"}');
  });
});
