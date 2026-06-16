import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatWalletAddress } from '@/features/wallet/useWalletStatus';
import { WalletPanel } from '@/features/wallet/WalletPanel';

type MockAccount = { address: string };
type MockWallet = { name: string };

interface MockConnection {
  account: MockAccount | null;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  supportedIntents: string[];
  wallet: MockWallet | null;
}

const walletMockState = vi.hoisted(
  (): {
    account: MockAccount | null;
    connection: MockConnection;
    currentNetwork: string;
    wallet: MockWallet | null;
  } => ({
    account: null,
    connection: {
      account: null,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
      supportedIntents: [],
      wallet: null,
    },
    currentNetwork: 'testnet',
    wallet: null,
  }),
);

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => walletMockState.account,
  useCurrentNetwork: () => walletMockState.currentNetwork,
  useCurrentWallet: () => walletMockState.wallet,
  useWalletConnection: () => walletMockState.connection,
}));

vi.mock('@mysten/dapp-kit-react/ui', () => ({
  ConnectButton: () => <button type="button">Connect wallet</button>,
}));

describe('WalletPanel', () => {
  beforeEach(() => {
    walletMockState.account = null;
    walletMockState.currentNetwork = 'testnet';
    walletMockState.wallet = null;
    walletMockState.connection = {
      account: null,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
      supportedIntents: [],
      wallet: null,
    };
  });

  it('renders disconnected wallet status and Testnet network copy', () => {
    render(<WalletPanel />);

    expect(screen.getByLabelText('Wallet status')).toBeInTheDocument();
    expect(screen.getByText('No wallet connected')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('testnet')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument();
  });

  it('renders connected wallet name, shortened account, network, and status', () => {
    const account = {
      address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    };
    const wallet = { name: 'Slush' };

    walletMockState.account = account;
    walletMockState.wallet = wallet;
    walletMockState.connection = {
      account,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      supportedIntents: ['sui:signTransaction', 'sui:signAndExecuteTransaction'],
      wallet,
    };

    render(<WalletPanel />);

    expect(screen.getByText('Slush')).toBeInTheDocument();
    expect(screen.getByText('0x1234...cdef')).toBeInTheDocument();
    expect(screen.getByText('testnet')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('2 wallet intents available.')).toBeInTheDocument();
  });
});

describe('formatWalletAddress', () => {
  it('keeps short addresses intact and shortens long addresses', () => {
    expect(formatWalletAddress('0x1234')).toBe('0x1234');
    expect(
      formatWalletAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    ).toBe('0x1234...cdef');
  });
});
