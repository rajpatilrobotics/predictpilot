import { suiConfig, type SupportedSuiNetwork } from '@/config/sui';

type ExplorerTarget = 'address' | 'object' | 'txblock';

export function buildExplorerUrl(
  target: ExplorerTarget,
  id: string,
  network: SupportedSuiNetwork = suiConfig.network,
) {
  const url = new URL(`/${target}/${id}`, suiConfig.explorerUrl);
  url.searchParams.set('network', network);
  return url.toString();
}
