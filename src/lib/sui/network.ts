export const supportedSuiNetworks = ['testnet'] as const;

export type SupportedSuiNetwork = (typeof supportedSuiNetworks)[number];
