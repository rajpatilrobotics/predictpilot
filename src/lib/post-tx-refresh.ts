import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { TransactionDigest } from '@/types/predict';
import type { AffectedObjectHint, PredictTransactionAction } from '@/types/tx';

export interface PostTransactionRefreshContext {
  action: PredictTransactionAction;
  affectedObjects: AffectedObjectHint[];
  digest: TransactionDigest;
}

export interface PostTransactionAuthoritativeRefresh {
  label: string;
  refresh: (context: PostTransactionRefreshContext) => Promise<void> | void;
}

export interface RunPostTransactionRefreshOptions extends PostTransactionRefreshContext {
  authoritativeRefreshes?: PostTransactionAuthoritativeRefresh[];
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
  queryKeys?: QueryKey[];
  service: string;
}

interface RefreshFailure {
  errorName: string;
  index: number;
  label: string;
  phase: 'authoritative' | 'indexed-query';
}

export async function runPostTransactionRefresh({
  action,
  affectedObjects,
  authoritativeRefreshes = [],
  digest,
  queryClient,
  queryKeys = [],
  service,
}: RunPostTransactionRefreshOptions): Promise<PredictPilotError | null> {
  const context: PostTransactionRefreshContext = {
    action,
    affectedObjects,
    digest,
  };
  const failures: RefreshFailure[] = [];

  for (const [index, step] of authoritativeRefreshes.entries()) {
    try {
      await step.refresh(context);
    } catch (error) {
      failures.push({
        errorName: errorNameOf(error),
        index,
        label: step.label,
        phase: 'authoritative',
      });
    }
  }

  for (const [index, queryKey] of queryKeys.entries()) {
    try {
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      failures.push({
        errorName: errorNameOf(error),
        index,
        label: `query-${index}`,
        phase: 'indexed-query',
      });
    }
  }

  if (failures.length === 0) {
    return null;
  }

  return createAppError('POST_TX_REFRESH_FAILED', {
    context: {
      action,
      affectedObjects: affectedObjects.length,
      directRefreshSteps: authoritativeRefreshes.length,
      digest,
      failedRefreshes: failures.length,
      firstErrorName: failures[0]?.errorName,
      firstFailureLabel: failures[0]?.label,
      firstFailurePhase: failures[0]?.phase,
      queryRefreshKeys: queryKeys.length,
      service,
    },
  });
}

function errorNameOf(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
