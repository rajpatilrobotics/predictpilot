import { runtimeConfig } from '@/config/env';

export const SUI_TESTNET_NETWORK = 'testnet';
export const SUI_TESTNET_WALLET_CHAIN = 'sui:testnet';

export const SUPPORTED_SUI_NETWORKS = [SUI_TESTNET_NETWORK] as const;
export const supportedSuiNetworks = SUPPORTED_SUI_NETWORKS;

export type SupportedSuiNetwork = (typeof SUPPORTED_SUI_NETWORKS)[number];
export type SupportedSuiWalletChain = typeof SUI_TESTNET_WALLET_CHAIN;

export const suiConfig = {
  explorerUrl: runtimeConfig.suiExplorerUrl,
  grpcUrl: runtimeConfig.suiGrpcUrl,
  network: runtimeConfig.suiNetwork,
  supportedNetworks: SUPPORTED_SUI_NETWORKS,
  walletChain: SUI_TESTNET_WALLET_CHAIN,
} as const;

export function isSupportedSuiNetwork(network: string): network is SupportedSuiNetwork {
  return supportedSuiNetworks.includes(network as SupportedSuiNetwork);
}

export function assertSupportedSuiNetwork(network: string): SupportedSuiNetwork {
  if (!isSupportedSuiNetwork(network)) {
    throw new Error(
      `Unsupported Sui network "${network}". PredictPilot currently supports Sui Testnet only.`,
    );
  }

  return network;
}
