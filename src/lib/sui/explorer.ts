import { runtimeConfig } from '@/config/env';
import type { SupportedSuiNetwork } from '@/lib/sui/network';

type ExplorerTarget = 'address' | 'object' | 'txblock';

export function buildExplorerUrl(
  target: ExplorerTarget,
  id: string,
  network: SupportedSuiNetwork = runtimeConfig.suiNetwork,
) {
  const url = new URL(`/${target}/${id}`, runtimeConfig.suiExplorerUrl);
  url.searchParams.set('network', network);
  return url.toString();
}
