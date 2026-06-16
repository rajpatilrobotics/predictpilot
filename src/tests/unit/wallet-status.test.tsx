import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestnetBanner } from '@/components/banners/TestnetBanner';
import { NetworkGuard } from '@/features/wallet/NetworkGuard';
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
    expect(screen.queryByLabelText('Wrong network warning')).not.toBeInTheDocument();
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

  it('renders a wrong-network warning with current and expected networks', () => {
    const account = {
      address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    };
    const wallet = { name: 'Slush' };

    walletMockState.account = account;
    walletMockState.currentNetwork = 'mainnet';
    walletMockState.wallet = wallet;
    walletMockState.connection = {
      account,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      supportedIntents: ['sui:signTransaction'],
      wallet,
    };

    render(<WalletPanel />);

    expect(screen.getByText('mainnet (expected testnet)')).toBeInTheDocument();
    expect(screen.getByLabelText('Wrong network warning')).toHaveTextContent(
      'Switch to Testnet',
    );
  });
});

describe('NetworkGuard', () => {
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

  it('allows children when disconnected or on Testnet', () => {
    const { rerender } = render(
      <NetworkGuard>
        <button type="button">Future execution CTA</button>
      </NetworkGuard>,
    );

    expect(screen.getByRole('button', { name: 'Future execution CTA' })).toBeInTheDocument();

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
      supportedIntents: [],
      wallet,
    };

    rerender(
      <NetworkGuard>
        <button type="button">Future execution CTA</button>
      </NetworkGuard>,
    );

    expect(screen.getByRole('button', { name: 'Future execution CTA' })).toBeInTheDocument();
  });

  it('replaces children with a blocker when connected on the wrong network', () => {
    const account = {
      address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    };
    const wallet = { name: 'Slush' };

    walletMockState.account = account;
    walletMockState.currentNetwork = 'mainnet';
    walletMockState.wallet = wallet;
    walletMockState.connection = {
      account,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      supportedIntents: [],
      wallet,
    };

    render(
      <NetworkGuard>
        <button type="button">Future execution CTA</button>
      </NetworkGuard>,
    );

    expect(screen.queryByRole('button', { name: 'Future execution CTA' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Wrong network')).toHaveTextContent('mainnet');
    expect(screen.getByLabelText('Wrong network')).toHaveTextContent('testnet');
  });
});

describe('TestnetBanner', () => {
  it('renders the permanent Testnet status banner', () => {
    render(<TestnetBanner />);

    expect(screen.getByLabelText('Testnet status')).toHaveTextContent('Sui Testnet only');
    expect(screen.getByLabelText('Testnet status')).toHaveTextContent('testnet');
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
