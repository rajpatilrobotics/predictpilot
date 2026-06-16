import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getOracleState, type OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { OracleStateModel } from '@/types/oracle';
import type { ObjectId } from '@/types/predict';

export interface UseOracleStateOptions {
  client?: OracleReadClient;
  enabled?: boolean;
  oracleId: ObjectId;
}

export function useOracleState({
  client,
  enabled = true,
  oracleId,
}: UseOracleStateOptions): UseQueryResult<OracleStateModel, PredictPilotError> {
  return useQuery<OracleStateModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getOracleState({ client, oracleId });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            oracleId,
            query: 'oracle-state',
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.oracle.state(oracleId),
  });
}
