import { suiConfig, type SupportedSuiNetwork } from '@/config/sui';

export type ExplorerTarget = 'address' | 'object' | 'txblock';

export interface FormatExplorerTextOptions {
  prefixLength?: number;
  suffixLength?: number;
}

export function buildExplorerUrl(
  target: ExplorerTarget,
  id: string,
  network: SupportedSuiNetwork = suiConfig.network,
) {
  const url = new URL(`/${target}/${encodeURIComponent(id)}`, suiConfig.explorerUrl);
  url.searchParams.set('network', network);
  return url.toString();
}

export function buildAddressExplorerUrl(address: string, network?: SupportedSuiNetwork) {
  return buildExplorerUrl('address', address, network);
}

export function buildObjectExplorerUrl(objectId: string, network?: SupportedSuiNetwork) {
  return buildExplorerUrl('object', objectId, network);
}

export function buildPackageExplorerUrl(packageId: string, network?: SupportedSuiNetwork) {
  return buildObjectExplorerUrl(packageId, network);
}

export function buildTxDigestExplorerUrl(digest: string, network?: SupportedSuiNetwork) {
  return buildExplorerUrl('txblock', digest, network);
}

export function formatExplorerText(
  value: string,
  { prefixLength = 8, suffixLength = 6 }: FormatExplorerTextOptions = {},
) {
  const minimumShortenedLength = prefixLength + suffixLength + 3;

  if (value.length <= minimumShortenedLength) {
    return value;
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}
