import { DAppKitProvider } from '@mysten/dapp-kit-react';
import type { ReactNode } from 'react';
import { dAppKit } from '@/config/dapp-kit';

interface DAppKitRuntimeProviderProps {
  children: ReactNode;
}

export function DAppKitRuntimeProvider({ children }: DAppKitRuntimeProviderProps) {
  return <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>;
}
