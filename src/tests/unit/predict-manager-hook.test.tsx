import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';
import type { AuthoritativeSuiClient } from '@/integrations/deepbook-predict/onchain/objects';
import { HttpClientError } from '@/lib/http';
import type { ObjectId, SuiAddress } from '@/types/predict';

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

const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const otherOwner =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756d' as SuiAddress;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const secondManagerId =
  '0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4' as ObjectId;
const packageId = predictDeploymentConfig.packageId.slice(2);

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });

  function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return TestQueryProvider;
}

function connectWallet(address: SuiAddress = owner) {
  const account = { address };
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
    supportedIntents: ['sui:signAndExecuteTransaction'],
    wallet,
  };
}

function resetWallet() {
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
}

function managerDto(id: ObjectId, managerOwner: SuiAddress) {
  return {
    checkpoint: 349_210_521,
    checkpoint_timestamp_ms: 1_781_634_000_000,
    digest: `digest-${id.slice(2, 8)}`,
    event_digest: `event-${id.slice(2, 8)}`,
    event_index: 0,
    manager_id: id,
    owner: managerOwner,
    package: packageId,
    sender: managerOwner,
    tx_index: 0,
  };
}

function createIndexedClient(overrides: Partial<PortfolioReadClient> = {}): PortfolioReadClient {
  return {
    fetchManagerPnlDto: vi.fn(),
    fetchManagerPositionsSummaryDto: vi.fn(),
    fetchManagerSummaryDto: vi.fn(),
    fetchManagersDto: vi.fn(),
    ...overrides,
  };
}

function createAuthoritativeClient(): AuthoritativeSuiClient {
  return {
    getObject: vi.fn(),
    listCoins: vi.fn(),
  };
}

function mockManagerObjectResponse() {
  return {
    object: {
      digest: 'manager-object-digest',
      json: null,
      objectId: managerId,
      owner: { Shared: { initial_shared_version: '1' } },
      previousTransaction: 'previous-manager-tx',
      type: `${predictDeploymentConfig.packageId}::predict_manager::PredictManager`,
      version: '42',
    },
  };
}

describe('usePredictManager', () => {
  beforeEach(() => {
    resetWallet();
  });

  it('does not fetch managers when the wallet is disconnected', () => {
    const indexedClient = createIndexedClient();
    const authoritativeClient = createAuthoritativeClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    expect(result.current).toMatchObject({
      isReady: false,
      requiresCreateManager: false,
      status: 'NO_WALLET',
    });
    expect(indexedClient.fetchManagersDto).not.toHaveBeenCalled();
    expect(authoritativeClient.getObject).not.toHaveBeenCalled();
  });

  it('exposes create-needed state when no manager belongs to the connected wallet', async () => {
    connectWallet();
    const indexedClient = createIndexedClient({
      fetchManagersDto: vi.fn().mockResolvedValue([managerDto(managerId, otherOwner)]),
    });
    const authoritativeClient = createAuthoritativeClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('NO_MANAGER'));
    expect(result.current).toMatchObject({
      isReady: false,
      manager: null,
      owner,
      requiresCreateManager: true,
    });
    expect(indexedClient.fetchManagersDto).toHaveBeenCalledTimes(1);
    expect(authoritativeClient.getObject).not.toHaveBeenCalled();
  });

  it('loads one indexed manager and confirms the manager object exists onchain', async () => {
    connectWallet();
    const indexedClient = createIndexedClient({
      fetchManagersDto: vi.fn().mockResolvedValue([managerDto(managerId, owner)]),
    });
    const authoritativeClient = createAuthoritativeClient();
    vi.mocked(authoritativeClient.getObject).mockResolvedValue(mockManagerObjectResponse());
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('READY'));
    expect(result.current).toMatchObject({
      authoritativeObject: {
        digest: 'manager-object-digest',
        id: managerId,
        previousTransaction: 'previous-manager-tx',
      },
      isReady: true,
      managerId,
      owner,
    });
    expect(authoritativeClient.getObject).toHaveBeenCalledWith({
      include: {
        json: false,
        previousTransaction: true,
      },
      objectId: managerId,
    });
    expect(result.current.warnings).toEqual([
      expect.objectContaining({ code: 'INDEXED_OWNER_ONLY' }),
    ]);
  });

  it('exposes ambiguous state and does not auto-select when multiple managers match', async () => {
    connectWallet();
    const indexedClient = createIndexedClient({
      fetchManagersDto: vi
        .fn()
        .mockResolvedValue([managerDto(managerId, owner), managerDto(secondManagerId, owner)]),
    });
    const authoritativeClient = createAuthoritativeClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('AMBIGUOUS'));
    expect(result.current).toMatchObject({
      isAmbiguous: true,
      isReady: false,
      manager: null,
      managerId: null,
      requiresCreateManager: false,
    });
    expect(result.current.matchingManagers).toHaveLength(2);
    expect(authoritativeClient.getObject).not.toHaveBeenCalled();
  });

  it('normalizes indexed server failures into PredictPilotError values', async () => {
    connectWallet();
    const indexedClient = createIndexedClient({
      fetchManagersDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'network',
          message: 'network unavailable',
          url: 'https://predict-server.testnet.mystenlabs.com/managers',
        }),
      ),
    });
    const authoritativeClient = createAuthoritativeClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('ERROR'));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        owner,
        query: 'managers',
      },
    });
    expect(authoritativeClient.getObject).not.toHaveBeenCalled();
  });

  it('normalizes onchain manager confirmation failures into PredictPilotError values', async () => {
    connectWallet();
    const indexedClient = createIndexedClient({
      fetchManagersDto: vi.fn().mockResolvedValue([managerDto(managerId, owner)]),
    });
    const authoritativeClient = createAuthoritativeClient();
    vi.mocked(authoritativeClient.getObject).mockRejectedValue(new Error('Object not found'));
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePredictManager({ authoritativeClient, indexedClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('ERROR'));
    expect(result.current.error).toMatchObject({
      code: 'MANAGER_NOT_FOUND',
      context: {
        managerId,
        owner,
        query: 'authoritative-manager-object',
      },
    });
    expect(result.current.isReady).toBe(false);
  });
});
