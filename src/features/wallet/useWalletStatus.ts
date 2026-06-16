import {
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentWallet,
  useWalletConnection,
} from '@mysten/dapp-kit-react';
import { suiConfig } from '@/config/sui';

export type WalletConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface WalletStatusModel {
  accountAddress: string | null;
  currentNetwork: string;
  expectedNetwork: string;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isExpectedNetwork: boolean;
  isReconnecting: boolean;
  isWrongNetwork: boolean;
  shortAddress: string | null;
  status: WalletConnectionStatus;
  statusLabel: string;
  supportedIntentsCount: number;
  walletName: string | null;
}

export function useWalletStatus(): WalletStatusModel {
  const account = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const wallet = useCurrentWallet();
  const connection = useWalletConnection();
  const accountAddress = account?.address ?? null;
  const isExpectedNetwork = currentNetwork === suiConfig.network;

  return {
    accountAddress,
    currentNetwork,
    expectedNetwork: suiConfig.network,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isDisconnected: connection.isDisconnected,
    isExpectedNetwork,
    isReconnecting: connection.isReconnecting,
    isWrongNetwork: connection.isConnected && !isExpectedNetwork,
    shortAddress: accountAddress === null ? null : formatWalletAddress(accountAddress),
    status: connection.status,
    statusLabel: formatConnectionStatus(connection.status),
    supportedIntentsCount: connection.supportedIntents.length,
    walletName: wallet?.name ?? connection.wallet?.name ?? null,
  };
}

export function formatWalletAddress(address: string) {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatConnectionStatus(status: WalletConnectionStatus) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'disconnected':
      return 'Disconnected';
    case 'reconnecting':
      return 'Reconnecting';
  }
}
