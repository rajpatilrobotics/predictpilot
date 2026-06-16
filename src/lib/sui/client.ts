import { SuiGrpcClient } from '@mysten/sui/grpc';
import { runtimeConfig } from '@/config/env';
import type { SupportedSuiNetwork } from '@/lib/sui/network';

export function createSuiClient(network: SupportedSuiNetwork = runtimeConfig.suiNetwork) {
  return new SuiGrpcClient({
    network,
    baseUrl: runtimeConfig.suiGrpcUrl,
  });
}
