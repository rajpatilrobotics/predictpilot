import { createDAppKit } from '@mysten/dapp-kit-react';
import { createSuiClient } from '@/lib/sui/client';
import { supportedSuiNetworks, type SupportedSuiNetwork } from '@/lib/sui/network';

function toSupportedNetwork(network: string): SupportedSuiNetwork {
  return network === 'testnet' ? network : 'testnet';
}

export const dAppKit = createDAppKit({
  networks: [...supportedSuiNetworks],
  defaultNetwork: 'testnet',
  createClient: (network) => createSuiClient(toSupportedNetwork(network)),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
