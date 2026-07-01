import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import {
  getLpSuppliesHistory,
  getLpWithdrawalsHistory,
  getPositionMintHistory,
  getPositionRedeemHistory,
  getRangeMintHistory,
  getRangeRedeemHistory,
  type HistoryReadClient,
} from '@/integrations/deepbook-predict/api/history';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type {
  BinaryMintHistoryRecord,
  BinaryRedeemHistoryRecord,
  LpSupplyHistoryRecord,
  LpWithdrawHistoryRecord,
  RangeMintHistoryRecord,
  RangeRedeemHistoryRecord,
} from '@/types/history';
import type { ObjectId, SuiAddress } from '@/types/predict';
import {
  selectTransactionHistory,
  type TransactionHistoryTimelineModel,
} from '../lib/history-selectors';

export interface UseTransactionHistoryOptions {
  client?: HistoryReadClient;
  enabled?: boolean;
  managerId?: ObjectId;
  owner?: SuiAddress | null;
}

export interface UseTransactionHistoryResult {
  data: TransactionHistoryTimelineModel | undefined;
  error: PredictPilotError | null;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

export function useTransactionHistory({
  client,
  enabled = true,
  managerId,
  owner,
}: UseTransactionHistoryOptions = {}): UseTransactionHistoryResult {
  const wallet = useWalletStatus();
  const managerDiscovery = usePredictManager({
    enabled: enabled && managerId === undefined,
  });
  const resolvedManagerId =
    managerId ?? (managerDiscovery.isReady ? managerDiscovery.managerId : null);
  const resolvedOwner =
    owner === undefined
      ? ((wallet.isConnected ? wallet.accountAddress : null) as SuiAddress | null)
      : owner;
  const canLoadHistory = enabled && resolvedManagerId !== null;

  const positionMintsQuery = useHistoryQuery<BinaryMintHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.positionMints(),
    queryName: 'history-position-mints',
    read: () => getPositionMintHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });
  const positionRedeemsQuery = useHistoryQuery<BinaryRedeemHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.positionRedeems(),
    queryName: 'history-position-redeems',
    read: () => getPositionRedeemHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });
  const rangeMintsQuery = useHistoryQuery<RangeMintHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.rangeMints(),
    queryName: 'history-range-mints',
    read: () => getRangeMintHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });
  const rangeRedeemsQuery = useHistoryQuery<RangeRedeemHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.rangeRedeems(),
    queryName: 'history-range-redeems',
    read: () => getRangeRedeemHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });
  const lpSuppliesQuery = useHistoryQuery<LpSupplyHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.lpSupplies(),
    queryName: 'history-lp-supplies',
    read: () => getLpSuppliesHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });
  const lpWithdrawalsQuery = useHistoryQuery<LpWithdrawHistoryRecord[]>({
    enabled: canLoadHistory,
    queryKey: predictQueryKeys.history.lpWithdrawals(),
    queryName: 'history-lp-withdrawals',
    read: () => getLpWithdrawalsHistory({ client }),
    managerId: resolvedManagerId,
    owner: resolvedOwner,
  });

  const queries = [
    positionMintsQuery,
    positionRedeemsQuery,
    rangeMintsQuery,
    rangeRedeemsQuery,
    lpSuppliesQuery,
    lpWithdrawalsQuery,
  ] as const;
  const firstError = queries.find((query) => query.error !== null)?.error ?? null;
  const hasAllData = queries.every((query) => query.data !== undefined);
  const data = useMemo(() => {
    if (!hasAllData || resolvedManagerId === null) {
      return undefined;
    }

    return selectTransactionHistory({
      lpSupplies: lpSuppliesQuery.data ?? [],
      lpWithdrawals: lpWithdrawalsQuery.data ?? [],
      managerId: resolvedManagerId,
      owner: resolvedOwner,
      positionMints: positionMintsQuery.data ?? [],
      positionRedeems: positionRedeemsQuery.data ?? [],
      rangeMints: rangeMintsQuery.data ?? [],
      rangeRedeems: rangeRedeemsQuery.data ?? [],
    });
  }, [
    hasAllData,
    lpSuppliesQuery.data,
    lpWithdrawalsQuery.data,
    positionMintsQuery.data,
    positionRedeemsQuery.data,
    rangeMintsQuery.data,
    rangeRedeemsQuery.data,
    resolvedManagerId,
    resolvedOwner,
  ]);

  return {
    data,
    error: firstError,
    isError: firstError !== null,
    isFetching: queries.some((query) => query.isFetching),
    isLoading: queries.some((query) => query.isLoading),
    isPending: queries.some((query) => query.isPending),
    isSuccess: canLoadHistory && queries.every((query) => query.isSuccess),
    refetch: async () => {
      const results = await Promise.all(queries.map((query) => query.refetch()));
      const firstFailedResult = results.find((result) => result.isError && result.error !== null);

      if (firstFailedResult !== undefined && firstFailedResult.error !== null) {
        throw toThrowableAppError(firstFailedResult.error);
      }
    },
  };
}

function useHistoryQuery<TData>({
  enabled,
  managerId,
  owner,
  queryKey,
  queryName,
  read,
}: {
  enabled: boolean;
  managerId: ObjectId | null;
  owner: SuiAddress | null;
  queryKey: readonly unknown[];
  queryName: string;
  read: () => Promise<TData>;
}): UseQueryResult<TData, PredictPilotError> {
  return useQuery<TData, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await read();
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              managerId,
              owner,
              query: queryName,
            },
          }),
        );
      }
    },
    queryKey,
  });
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
