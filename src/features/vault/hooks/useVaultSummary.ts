import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import { getVaultSummary, type VaultReadClient } from '@/integrations/deepbook-predict/api/vault';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

export interface UseVaultSummaryOptions {
  client?: VaultReadClient;
  enabled?: boolean;
  predictId?: ObjectId;
}

export function useVaultSummary({
  client,
  enabled = true,
  predictId = predictDeploymentConfig.predictObjectId,
}: UseVaultSummaryOptions = {}): UseQueryResult<VaultModel, PredictPilotError> {
  return useQuery<VaultModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getVaultSummary({ client, predictId });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            predictId,
            query: 'vault-summary',
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.vault.summary(predictId),
  });
}
