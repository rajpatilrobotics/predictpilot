import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PredictManagerPage,
  type PredictManagerPageProps,
} from '@/features/manager/PredictManagerPage';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import type { SuiAddress } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
  createTradeExecutionTransport,
  createTradeManagerState,
  createTradeManagerSummaryPortfolio,
  createTradePositionsSummary,
  createTradeWalletStatus,
  tradeTestManagerId,
  tradeTestOwner,
} from './trade-test-helpers';

interface MockQueryResult<TData> {
  data: TData | undefined;
  error: PredictPilotError | null;
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
}

interface HookState {
  manager: UsePredictManagerResult;
  managerSummary: MockQueryResult<ReturnType<typeof createTradeManagerSummaryPortfolio>>;
  positionsSummary: MockQueryResult<ReturnType<typeof createTradePositionsSummary>>;
  wallet: WalletStatusModel;
}

const dAppKitMocks = vi.hoisted(() => ({
  signAndExecuteTransaction: vi.fn(),
  simulateTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
}));

const hookState = vi.hoisted(
  (): HookState => ({
    manager: {
      authoritativeObject: null,
      error: null,
      isAmbiguous: false,
      isConfirming: false,
      isLoading: false,
      isReady: false,
      manager: null,
      managerId: null,
      matchingManagers: [],
      owner: null,
      requiresCreateManager: false,
      status: 'NO_WALLET',
      warnings: [],
    },
    managerSummary: {
      data: undefined,
      error: null,
      isError: false,
      isLoading: false,
      isPending: false,
      isSuccess: false,
    },
    positionsSummary: {
      data: undefined,
      error: null,
      isError: false,
      isLoading: false,
      isPending: false,
      isSuccess: false,
    },
    wallet: {
      accountAddress: null,
      currentNetwork: 'testnet',
      expectedNetwork: 'testnet',
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isExpectedNetwork: true,
      isReconnecting: false,
      isWrongNetwork: false,
      shortAddress: null,
      status: 'disconnected',
      statusLabel: 'Disconnected',
      supportedIntentsCount: 0,
      walletName: null,
    },
  }),
);

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentClient: () => ({
    simulateTransaction: dAppKitMocks.simulateTransaction,
    waitForTransaction: dAppKitMocks.waitForTransaction,
  }),
  useDAppKit: () => ({
    signAndExecuteTransaction: dAppKitMocks.signAndExecuteTransaction,
  }),
}));

vi.mock('@/features/wallet/useWalletStatus', async () => {
  const actual = await vi.importActual<typeof import('@/features/wallet/useWalletStatus')>(
    '@/features/wallet/useWalletStatus',
  );

  return {
    ...actual,
    useWalletStatus: () => hookState.wallet,
  };
});

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: () => hookState.manager,
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: () => hookState.managerSummary,
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: () => hookState.positionsSummary,
}));

beforeEach(() => {
  dAppKitMocks.signAndExecuteTransaction.mockReset();
  dAppKitMocks.simulateTransaction.mockReset();
  dAppKitMocks.waitForTransaction.mockReset();
  resetHookState();
});

describe('PredictManagerPage', () => {
  it('shows disconnected state without a wallet signature CTA', () => {
    renderManagerPage();

    expect(screen.getByRole('heading', { name: 'PredictManager' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect a Sui Testnet wallet before creating or inspecting a PredictManager.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Request wallet signature/i }),
    ).not.toBeInTheDocument();
  });

  it('shows no-manager state and opens a create-manager execution review after simulation', async () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      managerId: null,
      requiresCreateManager: true,
      status: 'NO_MANAGER',
    };
    const simulationTransport = createReadyTradeSimulationTransport();

    renderManagerPage({ simulationTransport });

    fireEvent.click(screen.getAllByRole('button', { name: 'Create PredictManager' })[0]);

    expect(
      await screen.findByRole('dialog', { name: /Create PredictManager execution review/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Request wallet signature/i })).toBeEnabled(),
    );
    expect(simulationTransport.simulateTransaction).toHaveBeenCalledOnce();
  });

  it('renders ready manager balances, authoritative metadata, and position counts', () => {
    setReadyManager();

    renderManagerPage({ walletDusdcBalanceQuote: 3_000_000n });

    expect(screen.getAllByText(tradeTestManagerId).length).toBeGreaterThan(0);
    expect(screen.getAllByText(tradeTestOwner).length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 DUSDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5 DUSDC').length).toBeGreaterThan(0);
    expect(screen.getByText('predict_manager::PredictManager')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows ambiguous managers without auto-selecting one', () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      isAmbiguous: true,
      isReady: false,
      managerId: null,
      matchingManagers: [
        managerCreated(tradeTestManagerId),
        managerCreated('0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4'),
      ],
      status: 'AMBIGUOUS',
    };

    renderManagerPage();

    expect(screen.getByRole('alert', { name: 'Ambiguous PredictManager' })).toBeInTheDocument();
    expect(screen.getByText(tradeTestManagerId)).toBeInTheDocument();
    expect(
      screen.getByText('0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4'),
    ).toBeInTheDocument();
  });

  it('blocks deposit review when wallet DUSDC is insufficient', () => {
    setReadyManager();
    renderManagerPage({ walletDusdcBalanceQuote: 1n });

    const depositPanel = screen.getByRole('region', { name: 'Deposit DUSDC to PredictManager' });

    fireEvent.change(within(depositPanel).getByLabelText('Deposit amount'), {
      target: { value: '1.00' },
    });

    expect(
      within(depositPanel).getByText('Amount exceeds the currently loaded balance.'),
    ).toBeInTheDocument();
    expect(
      within(depositPanel).getByRole('button', { name: 'Open execution review' }),
    ).toBeDisabled();
  });

  it('shows a deposit digest after mocked wallet execution succeeds', async () => {
    setReadyManager();
    const executionTransport = createTradeExecutionTransport();

    renderManagerPage({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
      walletDusdcBalanceQuote: 2_000_000n,
    });

    const depositPanel = screen.getByRole('region', { name: 'Deposit DUSDC to PredictManager' });
    fireEvent.change(within(depositPanel).getByLabelText('Deposit amount'), {
      target: { value: '1.00' },
    });
    fireEvent.click(within(depositPanel).getByRole('button', { name: 'Open execution review' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Request wallet signature/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Request wallet signature/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /View transaction/i }).length).toBeGreaterThan(0),
    );
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledOnce();
  });
});

function renderManagerPage({
  currentNetwork = 'testnet',
  executionTransport = createTradeExecutionTransport(),
  simulationTransport = createReadyTradeSimulationTransport(),
  walletDusdcBalanceQuote = 2_000_000n,
}: {
  currentNetwork?: string | null;
  executionTransport?: PredictManagerPageProps['executionTransport'];
  simulationTransport?: PredictManagerPageProps['simulationTransport'];
  walletDusdcBalanceQuote?: PredictManagerPageProps['walletDusdcBalanceQuote'];
} = {}) {
  return render(
    <PredictManagerPage
      currentNetwork={currentNetwork}
      executionTransport={executionTransport}
      sender={hookState.wallet.accountAddress as SuiAddress | null}
      simulationTransport={simulationTransport}
      walletDusdcBalanceQuote={walletDusdcBalanceQuote}
    />,
    { wrapper: createQueryWrapper() },
  );
}

function createQueryWrapper() {
  const providerClient = new QueryClient({
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
    return <QueryClientProvider client={providerClient}>{children}</QueryClientProvider>;
  }

  return TestQueryProvider;
}

function resetHookState() {
  hookState.wallet = {
    accountAddress: null,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: null,
    status: 'disconnected',
    statusLabel: 'Disconnected',
    supportedIntentsCount: 0,
    walletName: null,
  };
  hookState.manager = {
    authoritativeObject: null,
    error: null,
    isAmbiguous: false,
    isConfirming: false,
    isLoading: false,
    isReady: false,
    manager: null,
    managerId: null,
    matchingManagers: [],
    owner: null,
    requiresCreateManager: false,
    status: 'NO_WALLET',
    warnings: [],
  };
  hookState.managerSummary = queryIdle();
  hookState.positionsSummary = queryIdle();
}

function connectWallet() {
  hookState.wallet = createTradeWalletStatus();
}

function setReadyManager() {
  connectWallet();
  hookState.manager = createTradeManagerState();
  hookState.managerSummary = querySuccess(createTradeManagerSummaryPortfolio());
  hookState.positionsSummary = querySuccess(createTradePositionsSummary());
}

function baseManager(): UsePredictManagerResult {
  return {
    ...createTradeManagerState({
      authoritativeObject: null,
      isReady: false,
      manager: null,
      managerId: null,
      matchingManagers: [],
      owner: tradeTestOwner,
      status: 'NO_MANAGER',
    }),
  };
}

function managerCreated(managerId: string) {
  return {
    checkpoint: 1n,
    checkpointTimestampMs: 1_781_635_255_000n,
    digest: 'manager-created-digest',
    eventDigest: 'manager-created-event',
    eventIndex: 0,
    managerId: managerId as `0x${string}`,
    owner: tradeTestOwner,
    packageId:
      '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138' as `0x${string}`,
    sender: tradeTestOwner,
    txIndex: 0,
  };
}

function queryIdle<TData>(): MockQueryResult<TData> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
  };
}

function querySuccess<TData>(data: TData): MockQueryResult<TData> {
  return {
    data,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
  };
}
