import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getAskBounds, type OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { OracleAskBoundsModel } from '@/types/oracle';
import type { ObjectId } from '@/types/predict';

export interface UseAskBoundsOptions {
  client?: OracleReadClient;
  enabled?: boolean;
  oracleId: ObjectId;
}

export function useAskBounds({
  client,
  enabled = true,
  oracleId,
}: UseAskBoundsOptions): UseQueryResult<OracleAskBoundsModel, PredictPilotError> {
  return useQuery<OracleAskBoundsModel, PredictPilotError>({
    enabled,
    queryFn: async () => {
      try {
        return await getAskBounds({ client, oracleId });
      } catch (error) {
        const appError = normalizeAppError(error, {
          context: {
            oracleId,
            query: 'oracle-ask-bounds',
          },
        });
        const throwableError: Error & PredictPilotError = Object.assign(
          new Error(appError.message),
          appError,
        );
        throw throwableError;
      }
    },
    queryKey: predictQueryKeys.oracle.askBounds(oracleId),
  });
}
