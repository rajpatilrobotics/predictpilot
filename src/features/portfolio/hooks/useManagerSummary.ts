import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import {
  getManagerSummary,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId } from '@/types/predict';
import {
  selectManagerSummary,
  type ManagerSummaryPortfolioModel,
} from '../lib/portfolio-selectors';

export interface UseManagerSummaryOptions {
  client?: PortfolioReadClient;
  enabled?: boolean;
  managerId?: ObjectId;
}

export function useManagerSummary({
  client,
  enabled = true,
  managerId,
}: UseManagerSummaryOptions = {}): UseQueryResult<ManagerSummaryPortfolioModel, PredictPilotError> {
  const managerDiscovery = usePredictManager({
    enabled: enabled && managerId === undefined,
    indexedClient: client,
  });
  const resolvedManagerId =
    managerId ?? (managerDiscovery.isReady ? managerDiscovery.managerId : null);

  return useQuery<ManagerSummaryPortfolioModel, PredictPilotError>({
    enabled: enabled && resolvedManagerId !== null,
    queryFn: async () => {
      if (resolvedManagerId === null) {
        throw toThrowableAppError(
          normalizeAppError(new Error('PredictManager ID is missing'), {
            context: {
              query: 'manager-summary',
            },
          }),
        );
      }

      try {
        const summary = await getManagerSummary({ client, managerId: resolvedManagerId });
        return selectManagerSummary(summary);
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              managerId: resolvedManagerId,
              query: 'manager-summary',
            },
          }),
        );
      }
    },
    queryKey:
      resolvedManagerId === null
        ? [...predictQueryKeys.manager.all(), 'summary', null]
        : predictQueryKeys.manager.summary(resolvedManagerId),
  });
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
