import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from '@/config/dapp-kit';
import { createAppQueryClient } from '@/lib/query-client';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DAppKitProvider>
  );
}
