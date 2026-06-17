import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  runPostTransactionRefresh,
  type PostTransactionAuthoritativeRefresh,
  type PostTransactionRefreshContext,
} from '@/lib/post-tx-refresh';
import type { ObjectId, TransactionDigest } from '@/types/predict';
import type { AffectedObjectHint } from '@/types/tx';

const digest = 'tx-digest' as TransactionDigest;
const managerId = '0x2c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const affectedObjects: AffectedObjectHint[] = [
  {
    id: managerId,
    kind: 'manager',
    label: 'PredictManager',
  },
];

describe('runPostTransactionRefresh', () => {
  it('runs authoritative refreshes before indexed query invalidation', async () => {
    const calls: string[] = [];
    const authoritativeRefreshes: PostTransactionAuthoritativeRefresh[] = [
      {
        label: 'manager-object',
        refresh: vi.fn((context: PostTransactionRefreshContext) => {
          calls.push(`authoritative:${context.digest}`);
        }),
      },
      {
        label: 'wallet-coins',
        refresh: vi.fn((context: PostTransactionRefreshContext) => {
          calls.push(`authoritative:${context.affectedObjects[0]?.kind}`);
        }),
      },
    ];
    const queryKeys: QueryKey[] = [
      ['predict', 'manager', 'summary', managerId],
      ['predict', 'history', 'positions'],
    ];
    const { invalidateQueries, queryClient } = createMockQueryClient((queryKey) => {
      calls.push(`query:${queryKey.join('.')}`);
    });

    const warning = await runPostTransactionRefresh({
      action: 'MINT',
      affectedObjects,
      authoritativeRefreshes,
      digest,
      queryClient,
      queryKeys,
      service: 'test.postTxRefresh',
    });

    expect(warning).toBeNull();
    expect(calls).toEqual([
      'authoritative:tx-digest',
      'authoritative:manager',
      'query:predict.manager.summary.0x2c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d',
      'query:predict.history.positions',
    ]);
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('continues best-effort after refresh failures and returns a sanitized warning', async () => {
    const calls: string[] = [];
    const authoritativeRefreshes: PostTransactionAuthoritativeRefresh[] = [
      {
        label: 'manager-object',
        refresh: vi.fn(() => {
          calls.push('authoritative:failed');
          throw new Error('direct object read failed');
        }),
      },
      {
        label: 'wallet-coins',
        refresh: vi.fn(() => {
          calls.push('authoritative:ok');
        }),
      },
    ];
    const queryKeys: QueryKey[] = [
      ['predict', 'manager', 'positions', managerId],
      ['predict', 'history', 'ranges'],
    ];
    const { queryClient } = createMockQueryClient((queryKey) => {
      calls.push(`query:${String(queryKey[1])}`);

      if (queryKey[1] === 'manager') {
        throw new TypeError('cache unavailable');
      }
    });

    const warning = await runPostTransactionRefresh({
      action: 'REDEEM',
      affectedObjects,
      authoritativeRefreshes,
      digest,
      queryClient,
      queryKeys,
      service: 'test.postTxRefresh',
    });

    expect(calls).toEqual([
      'authoritative:failed',
      'authoritative:ok',
      'query:manager',
      'query:history',
    ]);
    expect(warning?.code).toBe('POST_TX_REFRESH_FAILED');
    expect(warning?.context).toMatchObject({
      action: 'REDEEM',
      affectedObjects: 1,
      directRefreshSteps: 2,
      digest,
      failedRefreshes: 2,
      firstErrorName: 'Error',
      firstFailureLabel: 'manager-object',
      firstFailurePhase: 'authoritative',
      queryRefreshKeys: 2,
      service: 'test.postTxRefresh',
    });
    expect(JSON.stringify(warning?.context)).not.toContain('direct object read failed');
  });

  it('handles empty refresh input without warning', async () => {
    const { invalidateQueries, queryClient } = createMockQueryClient();

    const warning = await runPostTransactionRefresh({
      action: 'SUPPLY',
      affectedObjects: [],
      digest,
      queryClient,
      service: 'test.postTxRefresh',
    });

    expect(warning).toBeNull();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('passes action, digest, sender-safe metadata, and affected objects to authority steps', async () => {
    const refresh = vi.fn();

    await runPostTransactionRefresh({
      action: 'WITHDRAW',
      affectedObjects,
      authoritativeRefreshes: [
        {
          label: 'authority-step',
          refresh,
        },
      ],
      digest,
      queryClient: createMockQueryClient().queryClient,
      queryKeys: [],
      service: 'test.postTxRefresh',
    });

    expect(refresh).toHaveBeenCalledWith({
      action: 'WITHDRAW',
      affectedObjects,
      digest,
    });
  });
});

function createMockQueryClient(onInvalidate?: (queryKey: QueryKey) => void) {
  const invalidateQueries = vi.fn((filters?: { queryKey?: QueryKey }) => {
    if (filters?.queryKey !== undefined) {
      onInvalidate?.(filters.queryKey);
    }
  });

  return {
    invalidateQueries,
    queryClient: {
      invalidateQueries: invalidateQueries as unknown as Pick<
        QueryClient,
        'invalidateQueries'
      >['invalidateQueries'],
    },
  };
}
