import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import {
  getPredictState,
  type MarketReadClient,
} from '@/integrations/deepbook-predict/api/markets';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId, PredictStateModel } from '@/types/predict';

export interface UsePredictStateOptions {
  client?: MarketReadClient;
  enabled?: boolean;
  predictId?: ObjectId;
}

export function usePredictState({
  client,
  enabled = true,
  predictId = predictDeploymentConfig.predictObjectId,
}: UsePredictStateOptions = {}): UseQueryResult<PredictStateModel, PredictPilotError> {
  return useQuery<PredictStateModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getPredictState({ client, predictId });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            predictId,
            query: 'predict-state',
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.market.state(predictId),
  });
}
