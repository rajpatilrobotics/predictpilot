import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getPredictOracles,
  type MarketReadClient,
} from '@/integrations/deepbook-predict/api/markets';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { OracleSummaryModel } from '@/types/oracle';
import type { ObjectId } from '@/types/predict';

export interface UsePredictOraclesOptions {
  client?: MarketReadClient;
  enabled?: boolean;
  predictId?: ObjectId;
}

export function usePredictOracles({
  client,
  enabled = true,
  predictId = predictDeploymentConfig.predictObjectId,
}: UsePredictOraclesOptions = {}): UseQueryResult<OracleSummaryModel[], PredictPilotError> {
  return useQuery<OracleSummaryModel[], PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getPredictOracles({ client, predictId });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            predictId,
            query: 'predict-oracles',
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.market.oracles(predictId),
  });
}
