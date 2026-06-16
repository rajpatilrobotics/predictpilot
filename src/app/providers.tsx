import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from '@/lib/sui/dapp-kit';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DAppKitProvider>
  );
}
