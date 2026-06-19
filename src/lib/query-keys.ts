import type { QueryKey } from '@tanstack/react-query';
import type { ObjectId } from '@/types/predict';

export const SECOND_MS = 1_000;

export const predictQueryStaleTimes = {
  default: 10 * SECOND_MS,
  history: 30 * SECOND_MS,
  manager: 5 * SECOND_MS,
  market: 30 * SECOND_MS,
  oracle: 5 * SECOND_MS,
  pnl: 15 * SECOND_MS,
  status: 10 * SECOND_MS,
  vault: 15 * SECOND_MS,
} as const;

export type PredictRangeQuery = 'ALL';

export interface PredictStatusQueryKeyParams {
  max_checkpoint_lag?: number;
  max_time_lag_seconds?: number;
}

export interface PredictManagerInvalidationParams {
  managerId: ObjectId;
  oracleId?: ObjectId;
}

export interface PredictVaultInvalidationParams {
  predictId: ObjectId;
}

export const predictQueryKeys = {
  all: ['deepbook-predict'] as const,

  status: (query: PredictStatusQueryKeyParams = {}) =>
    [
      ...predictQueryKeys.all,
      'status',
      {
        max_checkpoint_lag: query.max_checkpoint_lag ?? null,
        max_time_lag_seconds: query.max_time_lag_seconds ?? null,
      },
    ] as const,

  market: {
    all: () => [...predictQueryKeys.all, 'market'] as const,
    oracles: (predictId: ObjectId) =>
      [...predictQueryKeys.market.all(), 'oracles', predictId] as const,
    quoteAssets: (predictId: ObjectId) =>
      [...predictQueryKeys.market.all(), 'quote-assets', predictId] as const,
    state: (predictId: ObjectId) => [...predictQueryKeys.market.all(), 'state', predictId] as const,
  },

  oracle: {
    all: () => [...predictQueryKeys.all, 'oracle'] as const,
    askBounds: (oracleId: ObjectId) =>
      [...predictQueryKeys.oracle.detail(oracleId), 'ask-bounds'] as const,
    detail: (oracleId: ObjectId) => [...predictQueryKeys.oracle.all(), oracleId] as const,
    latestPrice: (oracleId: ObjectId) =>
      [...predictQueryKeys.oracle.detail(oracleId), 'prices', 'latest'] as const,
    latestSvi: (oracleId: ObjectId) =>
      [...predictQueryKeys.oracle.detail(oracleId), 'svi', 'latest'] as const,
    prices: (oracleId: ObjectId) =>
      [...predictQueryKeys.oracle.detail(oracleId), 'prices'] as const,
    state: (oracleId: ObjectId) => [...predictQueryKeys.oracle.detail(oracleId), 'state'] as const,
    svi: (oracleId: ObjectId) => [...predictQueryKeys.oracle.detail(oracleId), 'svi'] as const,
  },

  manager: {
    all: () => [...predictQueryKeys.all, 'manager'] as const,
    detail: (managerId: ObjectId) => [...predictQueryKeys.manager.all(), managerId] as const,
    list: () => [...predictQueryKeys.manager.all(), 'list'] as const,
    positionsSummary: (managerId: ObjectId) =>
      [...predictQueryKeys.manager.detail(managerId), 'positions-summary'] as const,
    summary: (managerId: ObjectId) =>
      [...predictQueryKeys.manager.detail(managerId), 'summary'] as const,
  },

  vault: {
    all: () => [...predictQueryKeys.all, 'vault'] as const,
    detail: (predictId: ObjectId) => [...predictQueryKeys.vault.all(), predictId] as const,
    performance: (predictId: ObjectId, range: PredictRangeQuery = 'ALL') =>
      [...predictQueryKeys.vault.detail(predictId), 'performance', range] as const,
    summary: (predictId: ObjectId) =>
      [...predictQueryKeys.vault.detail(predictId), 'summary'] as const,
  },

  pnl: {
    all: () => [...predictQueryKeys.all, 'pnl'] as const,
    manager: (managerId: ObjectId, range: PredictRangeQuery = 'ALL') =>
      [...predictQueryKeys.pnl.all(), 'manager', managerId, range] as const,
  },

  history: {
    all: () => [...predictQueryKeys.all, 'history'] as const,
    lpSupplies: () => [...predictQueryKeys.history.all(), 'lp', 'supplies'] as const,
    lpWithdrawals: () => [...predictQueryKeys.history.all(), 'lp', 'withdrawals'] as const,
    oracleTrades: (oracleId: ObjectId) =>
      [...predictQueryKeys.history.all(), 'oracle-trades', oracleId] as const,
    positionMints: () => [...predictQueryKeys.history.all(), 'positions', 'minted'] as const,
    positionRedeems: () => [...predictQueryKeys.history.all(), 'positions', 'redeemed'] as const,
    rangeMints: () => [...predictQueryKeys.history.all(), 'ranges', 'minted'] as const,
    rangeRedeems: () => [...predictQueryKeys.history.all(), 'ranges', 'redeemed'] as const,
  },
} as const;

export const predictInvalidationKeys = {
  afterManagerWrite({ managerId, oracleId }: PredictManagerInvalidationParams): QueryKey[] {
    const keys: QueryKey[] = [
      predictQueryKeys.manager.summary(managerId),
      predictQueryKeys.manager.positionsSummary(managerId),
      predictQueryKeys.pnl.manager(managerId),
      predictQueryKeys.history.positionMints(),
      predictQueryKeys.history.positionRedeems(),
      predictQueryKeys.history.rangeMints(),
      predictQueryKeys.history.rangeRedeems(),
    ];

    if (oracleId !== undefined) {
      keys.push(predictQueryKeys.oracle.state(oracleId));
      keys.push(predictQueryKeys.oracle.askBounds(oracleId));
      keys.push(predictQueryKeys.history.oracleTrades(oracleId));
    }

    return keys;
  },

  afterVaultWrite({ predictId }: PredictVaultInvalidationParams): QueryKey[] {
    return [
      predictQueryKeys.vault.summary(predictId),
      predictQueryKeys.vault.performance(predictId),
      predictQueryKeys.history.lpSupplies(),
      predictQueryKeys.history.lpWithdrawals(),
    ];
  },
} as const;
