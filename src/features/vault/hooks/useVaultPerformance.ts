import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getVaultPerformance,
  type VaultReadClient,
} from '@/integrations/deepbook-predict/api/vault';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys, type PredictRangeQuery } from '@/lib/query-keys';
import type { ObjectId } from '@/types/predict';
import type { VaultPerformanceModel } from '@/types/vault';

export interface UseVaultPerformanceOptions {
  client?: VaultReadClient;
  enabled?: boolean;
  predictId?: ObjectId;
  range?: PredictRangeQuery;
}

export function useVaultPerformance({
  client,
  enabled = true,
  predictId = predictDeploymentConfig.predictObjectId,
  range = 'ALL',
}: UseVaultPerformanceOptions = {}): UseQueryResult<VaultPerformanceModel, PredictPilotError> {
  return useQuery<VaultPerformanceModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getVaultPerformance({ client, predictId, range });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            predictId,
            query: 'vault-performance',
            range,
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.vault.performance(predictId, range),
  });
}
