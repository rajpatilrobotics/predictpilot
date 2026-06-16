import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import {
  getManagers,
  type PortfolioReadClient,
} from '@/integrations/deepbook-predict/api/portfolio';
import {
  readAuthoritativeManagerObject,
  type AuthoritativeObjectSnapshot,
  type AuthoritativeSuiClient,
} from '@/integrations/deepbook-predict/onchain/objects';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { predictQueryKeys } from '@/lib/query-keys';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { PredictManagerCreatedModel } from '@/types/portfolio';
import {
  selectPredictManagerForOwner,
  type PredictManagerDiscoveryStatus,
  type PredictManagerDiscoveryWarning,
} from '../lib/manager-select';

export type PredictManagerHookStatus = PredictManagerDiscoveryStatus | 'CONFIRMING' | 'LOADING';

export interface UsePredictManagerOptions {
  authoritativeClient?: AuthoritativeSuiClient;
  enabled?: boolean;
  indexedClient?: PortfolioReadClient;
}

export interface UsePredictManagerResult {
  authoritativeObject: AuthoritativeObjectSnapshot | null;
  error: PredictPilotError | null;
  isAmbiguous: boolean;
  isConfirming: boolean;
  isLoading: boolean;
  isReady: boolean;
  manager: PredictManagerCreatedModel | null;
  managerId: ObjectId | null;
  matchingManagers: PredictManagerCreatedModel[];
  owner: SuiAddress | null;
  requiresCreateManager: boolean;
  status: PredictManagerHookStatus;
  warnings: PredictManagerDiscoveryWarning[];
}

export function usePredictManager({
  authoritativeClient,
  enabled = true,
  indexedClient,
}: UsePredictManagerOptions = {}): UsePredictManagerResult {
  const wallet = useWalletStatus();
  const owner = wallet.accountAddress as SuiAddress | null;
  const canLoadManagers = enabled && wallet.isConnected && owner !== null;

  const managersQuery = useQuery<PredictManagerCreatedModel[], PredictPilotError>({
    enabled: canLoadManagers,
    queryFn: async () => {
      try {
        return await getManagers({ client: indexedClient });
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              owner,
              query: 'managers',
            },
          }),
        );
      }
    },
    queryKey: predictQueryKeys.manager.list(),
  });

  const selection = useMemo(
    () =>
      selectPredictManagerForOwner({
        error: managersQuery.error ?? undefined,
        managers: managersQuery.data ?? [],
        owner,
      }),
    [managersQuery.data, managersQuery.error, owner],
  );
  const selectedManagerId = selection.status === 'READY' ? selection.managerId : null;

  const authoritativeQuery = useQuery<AuthoritativeObjectSnapshot, PredictPilotError>({
    enabled: canLoadManagers && managersQuery.isSuccess && selectedManagerId !== null,
    queryFn: async () => {
      if (selectedManagerId === null) {
        throw toThrowableAppError(
          normalizeAppError(new Error('PredictManager ID is missing'), {
            context: {
              owner,
              query: 'authoritative-manager-object',
            },
          }),
        );
      }

      try {
        return await readAuthoritativeManagerObject({
          client: authoritativeClient,
          includeJson: false,
          managerId: selectedManagerId,
        });
      } catch (error) {
        throw toThrowableAppError(
          normalizeAppError(error, {
            context: {
              managerId: selectedManagerId,
              owner,
              query: 'authoritative-manager-object',
            },
          }),
        );
      }
    },
    queryKey:
      selectedManagerId === null
        ? [...predictQueryKeys.manager.all(), 'authoritative-object', null]
        : [...predictQueryKeys.manager.detail(selectedManagerId), 'authoritative-object'],
  });

  if (!canLoadManagers) {
    return managerResult({
      authoritativeObject: null,
      error: null,
      isLoading: false,
      selection,
      status: 'NO_WALLET',
    });
  }

  if (managersQuery.isPending) {
    return managerResult({
      authoritativeObject: null,
      error: null,
      isLoading: true,
      selection,
      status: 'LOADING',
    });
  }

  if (selection.status === 'ERROR') {
    return managerResult({
      authoritativeObject: null,
      error: selection.error,
      isLoading: false,
      selection,
      status: 'ERROR',
    });
  }

  if (selectedManagerId !== null && authoritativeQuery.isPending) {
    return managerResult({
      authoritativeObject: null,
      error: null,
      isLoading: false,
      selection,
      status: 'CONFIRMING',
    });
  }

  if (authoritativeQuery.error !== null) {
    return managerResult({
      authoritativeObject: null,
      error: authoritativeQuery.error,
      isLoading: false,
      selection,
      status: 'ERROR',
    });
  }

  return managerResult({
    authoritativeObject: authoritativeQuery.data ?? null,
    error: null,
    isLoading: false,
    selection,
    status: selection.status,
  });
}

function managerResult({
  authoritativeObject,
  error,
  isLoading,
  selection,
  status,
}: {
  authoritativeObject: AuthoritativeObjectSnapshot | null;
  error: PredictPilotError | null;
  isLoading: boolean;
  selection: ReturnType<typeof selectPredictManagerForOwner>;
  status: PredictManagerHookStatus;
}): UsePredictManagerResult {
  return {
    authoritativeObject,
    error,
    isAmbiguous: status === 'AMBIGUOUS',
    isConfirming: status === 'CONFIRMING',
    isLoading,
    isReady: status === 'READY' && authoritativeObject !== null,
    manager: selection.manager,
    managerId: selection.managerId,
    matchingManagers: selection.matchingManagers,
    owner: selection.owner,
    requiresCreateManager: status === 'NO_MANAGER',
    status,
    warnings: selection.warnings,
  };
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
