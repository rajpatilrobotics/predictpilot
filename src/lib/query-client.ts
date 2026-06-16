import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { predictQueryKeys, predictQueryStaleTimes } from './query-keys';

export const appQueryClientConfig = {
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: 5 * 60 * 1_000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: predictQueryStaleTimes.default,
    },
  },
} satisfies QueryClientConfig;

export function createAppQueryClient() {
  const queryClient = new QueryClient(appQueryClientConfig);
  applyPredictQueryDefaults(queryClient);
  return queryClient;
}

export function applyPredictQueryDefaults(queryClient: QueryClient) {
  queryClient.setQueryDefaults(predictQueryKeys.status(), {
    staleTime: predictQueryStaleTimes.status,
  });
  queryClient.setQueryDefaults(predictQueryKeys.market.all(), {
    staleTime: predictQueryStaleTimes.market,
  });
  queryClient.setQueryDefaults(predictQueryKeys.oracle.all(), {
    staleTime: predictQueryStaleTimes.oracle,
  });
  queryClient.setQueryDefaults(predictQueryKeys.manager.all(), {
    staleTime: predictQueryStaleTimes.manager,
  });
  queryClient.setQueryDefaults(predictQueryKeys.vault.all(), {
    staleTime: predictQueryStaleTimes.vault,
  });
  queryClient.setQueryDefaults(predictQueryKeys.pnl.all(), {
    staleTime: predictQueryStaleTimes.pnl,
  });
  queryClient.setQueryDefaults(predictQueryKeys.history.all(), {
    staleTime: predictQueryStaleTimes.history,
  });

  return queryClient;
}
