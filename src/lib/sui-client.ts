import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  assertSupportedSuiNetwork,
  suiConfig,
  type SupportedSuiNetwork,
} from '@/config/sui';

export interface CreateSuiGrpcClientOptions {
  grpcUrl?: string;
  network?: SupportedSuiNetwork;
}

export function createSuiGrpcClient({
  grpcUrl = suiConfig.grpcUrl,
  network = suiConfig.network,
}: CreateSuiGrpcClientOptions = {}) {
  return new SuiGrpcClient({
    baseUrl: grpcUrl,
    network: assertSupportedSuiNetwork(network),
  });
}

export function createSuiGrpcClientForNetwork(network: string) {
  return createSuiGrpcClient({
    network: assertSupportedSuiNetwork(network),
  });
}

export const appSuiClient = createSuiGrpcClient();
