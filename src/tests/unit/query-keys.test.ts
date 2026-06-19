import { describe, expect, it } from 'vitest';
import { createAppQueryClient } from '@/lib/query-client';
import {
  predictInvalidationKeys,
  predictQueryKeys,
  predictQueryStaleTimes,
} from '@/lib/query-keys';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3';
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';

describe('Predict query keys', () => {
  it('generates deterministic protocol-specific keys for every namespace', () => {
    expect(predictQueryKeys.market.state(predictId)).toEqual([
      'deepbook-predict',
      'market',
      'state',
      predictId,
    ]);
    expect(predictQueryKeys.oracle.state(oracleId)).toEqual([
      'deepbook-predict',
      'oracle',
      oracleId,
      'state',
    ]);
    expect(predictQueryKeys.manager.summary(managerId)).toEqual([
      'deepbook-predict',
      'manager',
      managerId,
      'summary',
    ]);
    expect(predictQueryKeys.vault.performance(predictId)).toEqual([
      'deepbook-predict',
      'vault',
      predictId,
      'performance',
      'ALL',
    ]);
    expect(predictQueryKeys.pnl.manager(managerId)).toEqual([
      'deepbook-predict',
      'pnl',
      'manager',
      managerId,
      'ALL',
    ]);
    expect(predictQueryKeys.history.positionMints()).toEqual([
      'deepbook-predict',
      'history',
      'positions',
      'minted',
    ]);
  });

  it('normalizes optional status query params into a stable object segment', () => {
    expect(predictQueryKeys.status()).toEqual([
      'deepbook-predict',
      'status',
      {
        max_checkpoint_lag: null,
        max_time_lag_seconds: null,
      },
    ]);
    expect(predictQueryKeys.status({ max_checkpoint_lag: 10 })).toEqual([
      'deepbook-predict',
      'status',
      {
        max_checkpoint_lag: 10,
        max_time_lag_seconds: null,
      },
    ]);
  });

  it('keeps oracle reads fresher than history reads', () => {
    expect(predictQueryStaleTimes.oracle).toBeLessThan(predictQueryStaleTimes.history);
    expect(predictQueryStaleTimes.manager).toBeLessThan(predictQueryStaleTimes.history);
    expect(predictQueryStaleTimes.market).toBeGreaterThanOrEqual(predictQueryStaleTimes.vault);
  });

  it('builds targeted invalidation keys after manager writes', () => {
    expect(predictInvalidationKeys.afterManagerWrite({ managerId, oracleId })).toEqual([
      predictQueryKeys.manager.summary(managerId),
      predictQueryKeys.manager.positionsSummary(managerId),
      predictQueryKeys.pnl.manager(managerId),
      predictQueryKeys.history.positionMints(),
      predictQueryKeys.history.positionRedeems(),
      predictQueryKeys.history.rangeMints(),
      predictQueryKeys.history.rangeRedeems(),
      predictQueryKeys.oracle.state(oracleId),
      predictQueryKeys.oracle.askBounds(oracleId),
      predictQueryKeys.history.oracleTrades(oracleId),
    ]);
  });

  it('builds targeted invalidation keys after vault writes', () => {
    expect(predictInvalidationKeys.afterVaultWrite({ predictId })).toEqual([
      predictQueryKeys.vault.summary(predictId),
      predictQueryKeys.vault.performance(predictId),
      predictQueryKeys.history.lpSupplies(),
      predictQueryKeys.history.lpWithdrawals(),
    ]);
  });
});

describe('Predict query client', () => {
  it('applies shared defaults and namespace stale-time policies', () => {
    const queryClient = createAppQueryClient();

    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: predictQueryStaleTimes.default,
    });
    expect(queryClient.getQueryDefaults(predictQueryKeys.oracle.state(oracleId))).toMatchObject({
      staleTime: predictQueryStaleTimes.oracle,
    });
    expect(queryClient.getQueryDefaults(predictQueryKeys.history.positionMints())).toMatchObject({
      staleTime: predictQueryStaleTimes.history,
    });
  });
});
