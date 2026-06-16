import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import {
  getManagerPnl,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys, type PredictRangeQuery } from '@/lib/query-keys';
import type { ObjectId } from '@/types/predict';
import type { ManagerPnlModel } from '@/types/portfolio';

export interface UsePnlOptions {
  client?: PortfolioReadClient;
  enabled?: boolean;
  managerId?: ObjectId;
  range?: PredictRangeQuery;
}

export function usePnl({
  client,
  enabled = true,
  managerId,
  range = 'ALL',
}: UsePnlOptions = {}): UseQueryResult<ManagerPnlModel, PredictPilotError> {
  const managerDiscovery = usePredictManager({
    enabled: enabled && managerId === undefined,
    indexedClient: client,
  });
  const resolvedManagerId =
    managerId ?? (managerDiscovery.isReady ? managerDiscovery.managerId : null);

  return useQuery<ManagerPnlModel, PredictPilotError>({
    enabled: enabled && resolvedManagerId !== null,
    queryFn: async () => {
      if (resolvedManagerId === null) {
        throw toThrowableAppError(
          normalizeAppError(new Error('PredictManager ID is missing'), {
            context: {
              query: 'manager-pnl',
              range,
            },
          }),
        );
      }

      try {
        return await getManagerPnl({ client, managerId: resolvedManagerId, range });
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              managerId: resolvedManagerId,
              query: 'manager-pnl',
              range,
            },
          }),
        );
      }
    },
    queryKey:
      resolvedManagerId === null
        ? [...predictQueryKeys.pnl.all(), 'manager', null, range]
        : predictQueryKeys.pnl.manager(resolvedManagerId, range),
  });
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
