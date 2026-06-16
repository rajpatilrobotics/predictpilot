import { createDAppKit } from '@mysten/dapp-kit-react';
import { suiConfig } from '@/config/sui';
import { createSuiGrpcClientForNetwork } from '@/lib/sui-client';

export const dAppKit = createDAppKit({
  networks: [...suiConfig.supportedNetworks],
  defaultNetwork: suiConfig.network,
  createClient: createSuiGrpcClientForNetwork,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
