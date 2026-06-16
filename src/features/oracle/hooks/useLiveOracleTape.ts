import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOracleState, type OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { getOracleFreshness, type OracleFreshnessBreakdown } from '@/lib/oracle-status';
import { predictQueryKeys } from '@/lib/query-keys';
import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';
import type { ObjectId, TimestampMs } from '@/types/predict';
import {
  predictOracleLiveEventMetadata,
  type PredictOracleLiveEventMetadata,
} from '../lib/live-oracle-events';

export const ORACLE_LIVE_TAPE_DEFAULT_POLL_INTERVAL_MS = 3_000;
export const ORACLE_LIVE_TAPE_SOURCE = 'PREDICT_SERVER_POLLING';

export interface UseLiveOracleTapeOptions {
  client?: OracleReadClient;
  enabled?: boolean;
  nowMs?: number | TimestampMs;
  oracleId: ObjectId;
  pollIntervalMs?: number;
}

export interface LiveOracleTapeModel {
  eventMetadata: PredictOracleLiveEventMetadata;
  freshness: OracleFreshnessBreakdown;
  lastObservedLifecycleStatus: OracleLifecycleStatus;
  lastObservedPriceTimestampMs: TimestampMs | null;
  lastObservedSviTimestampMs: TimestampMs | null;
  lastPollAtMs: TimestampMs;
  latestOracleState: OracleStateModel;
  lifecycleStatus: OracleLifecycleStatus;
  oracleId: ObjectId;
  pollIntervalMs: number;
  source: typeof ORACLE_LIVE_TAPE_SOURCE;
  updateCount: number;
}

export interface UseLiveOracleTapeResult {
  data: LiveOracleTapeModel | undefined;
  error: PredictPilotError | null;
  eventMetadata: PredictOracleLiveEventMetadata;
  isEnabled: boolean;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  pollIntervalMs: number;
  refetch: () => Promise<unknown>;
}

export function useLiveOracleTape({
  client,
  enabled = true,
  nowMs,
  oracleId,
  pollIntervalMs = ORACLE_LIVE_TAPE_DEFAULT_POLL_INTERVAL_MS,
}: UseLiveOracleTapeOptions): UseLiveOracleTapeResult {
  const [updateCount, setUpdateCount] = useState(0);
  const previousSignatureRef = useRef<string | null>(null);

  const query = useQuery<OracleStateModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getOracleState({ client, oracleId });
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              oracleId,
              query: 'live-oracle-tape',
              source: ORACLE_LIVE_TAPE_SOURCE,
            },
          }),
        );
      }
    },
    queryKey: [...predictQueryKeys.oracle.detail(oracleId), 'live-tape'],
    refetchInterval: enabled ? pollIntervalMs : false,
  });

  const signature = query.data === undefined ? null : oracleTapeSignature(query.data);

  useEffect(() => {
    if (!enabled || signature === null) {
      return;
    }

    if (previousSignatureRef.current === signature) {
      return;
    }

    previousSignatureRef.current = signature;
    setUpdateCount((count) => count + 1);
  }, [enabled, signature]);

  const data = useMemo<LiveOracleTapeModel | undefined>(() => {
    if (query.data === undefined) {
      return undefined;
    }

    const freshnessNowMs = nowMs ?? query.dataUpdatedAt;

    return {
      eventMetadata: predictOracleLiveEventMetadata,
      freshness: getOracleFreshness({
        nowMs: freshnessNowMs,
        oracleState: query.data,
      }),
      lastObservedLifecycleStatus: query.data.oracle.lifecycleStatus,
      lastObservedPriceTimestampMs: query.data.latestPrice?.onchainTimestampMs ?? null,
      lastObservedSviTimestampMs: query.data.latestSvi?.onchainTimestampMs ?? null,
      lastPollAtMs: toTimestampMs(nowMs ?? query.dataUpdatedAt),
      latestOracleState: query.data,
      lifecycleStatus: query.data.oracle.lifecycleStatus,
      oracleId,
      pollIntervalMs,
      source: ORACLE_LIVE_TAPE_SOURCE,
      updateCount,
    };
  }, [nowMs, oracleId, pollIntervalMs, query.data, query.dataUpdatedAt, updateCount]);

  return {
    data,
    error: query.error,
    eventMetadata: predictOracleLiveEventMetadata,
    isEnabled: enabled,
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    pollIntervalMs,
    refetch: query.refetch,
  };
}

function oracleTapeSignature(oracleState: OracleStateModel): string {
  return [
    oracleState.oracle.lifecycleStatus,
    oracleState.oracle.activatedAtMs?.toString() ?? 'null',
    oracleState.oracle.settlementPrice1e9?.toString() ?? 'null',
    oracleState.oracle.settledAtMs?.toString() ?? 'null',
    oracleState.latestPrice?.onchainTimestampMs.toString() ?? 'null',
    oracleState.latestSvi?.onchainTimestampMs.toString() ?? 'null',
  ].join('|');
}

function toTimestampMs(value: number | TimestampMs): TimestampMs {
  if (typeof value === 'bigint') {
    return value;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Expected a safe millisecond integer, received: ${value}`);
  }

  return BigInt(value);
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
