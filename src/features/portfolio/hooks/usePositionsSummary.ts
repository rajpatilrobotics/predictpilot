import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import {
  getManagerPositionsSummary,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId } from '@/types/predict';
import {
  normalizeManagerPositionsSummary,
  type NormalizedManagerPositionsSummaryModel,
} from '../lib/portfolio-selectors';

export interface UsePositionsSummaryOptions {
  client?: PortfolioReadClient;
  enabled?: boolean;
  managerId?: ObjectId;
}

export function usePositionsSummary({
  client,
  enabled = true,
  managerId,
}: UsePositionsSummaryOptions = {}): UseQueryResult<
  NormalizedManagerPositionsSummaryModel,
  PredictPilotError
> {
  const managerDiscovery = usePredictManager({
    enabled: enabled && managerId === undefined,
    indexedClient: client,
  });
  const resolvedManagerId =
    managerId ?? (managerDiscovery.isReady ? managerDiscovery.managerId : null);

  return useQuery<NormalizedManagerPositionsSummaryModel, PredictPilotError>({
    enabled: enabled && resolvedManagerId !== null,
    queryFn: async () => {
      if (resolvedManagerId === null) {
        throw toThrowableAppError(
          normalizeAppError(new Error('PredictManager ID is missing'), {
            context: {
              query: 'positions-summary',
            },
          }),
        );
      }

      try {
        const summary = await getManagerPositionsSummary({ client, managerId: resolvedManagerId });
        return normalizeManagerPositionsSummary(summary);
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              managerId: resolvedManagerId,
              query: 'positions-summary',
            },
          }),
        );
      }
    },
    queryKey:
      resolvedManagerId === null
        ? [...predictQueryKeys.manager.all(), 'positions-summary', null]
        : predictQueryKeys.manager.positionsSummary(resolvedManagerId),
  });
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
