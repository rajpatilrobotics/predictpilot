import { suiConfig, type SupportedSuiNetwork } from '@/config/sui';
import {
  appSuiClient,
  createSuiGrpcClient,
  createSuiGrpcClientForNetwork,
  type CreateSuiGrpcClientOptions,
} from '@/lib/sui-client';

export function createSuiClient(network: SupportedSuiNetwork = suiConfig.network) {
  return createSuiGrpcClient({ network });
}

export {
  appSuiClient,
  createSuiGrpcClient,
  createSuiGrpcClientForNetwork,
  type CreateSuiGrpcClientOptions,
};
