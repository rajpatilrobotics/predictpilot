import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode, useState } from 'react';
import { ProofSessionProvider } from '@/features/proof/ProofSessionProvider';
import { createAppQueryClient } from '@/lib/query-client';

const DAppKitRuntimeProvider = lazy(async () => ({
  default: (await import('@/app/DAppKitRuntimeProvider')).DAppKitRuntimeProvider,
}));

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <Suspense fallback={<AppProviderLoadingState />}>
      <DAppKitRuntimeProvider>
        <QueryClientProvider client={queryClient}>
          <ProofSessionProvider>{children}</ProofSessionProvider>
        </QueryClientProvider>
      </DAppKitRuntimeProvider>
    </Suspense>
  );
}

function AppProviderLoadingState() {
  return (
    <div
      aria-label="App provider loading state"
      className="min-h-screen bg-[#f4f7f6] p-4 text-sm font-semibold text-[#315447]"
      role="status"
    >
      Loading PredictPilot wallet runtime...
    </div>
  );
}
