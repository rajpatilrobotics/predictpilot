import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';
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

const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const predictId = '0x49c25811456d931d4276ec2719f0bbfa9c3b977899f77879d3fcaf4e62864f3f';
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

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

function createPortfolioClient(overrides: Partial<PortfolioReadClient> = {}): PortfolioReadClient {
  return {
    fetchManagerPnlDto: vi.fn(),
    fetchManagerPositionsSummaryDto: vi.fn(),
    fetchManagerSummaryDto: vi.fn(),
    fetchManagersDto: vi.fn(),
    ...overrides,
  };
}

function managerSummaryDto() {
  return {
    account_value: 1_250,
    awaiting_settlement_positions: 1,
    balances: [
      {
        balance: 750,
        quote_asset: quoteAsset,
      },
    ],
    manager_id: managerId,
    open_exposure: 420,
    open_positions: 2,
    owner,
    realized_pnl: 20,
    redeemable_value: 100,
    trading_balance: 750,
    unrealized_pnl: 80,
  };
}

function binaryPositionDto(overrides: Record<string, unknown> = {}) {
  return {
    average_entry_price: 420_000_000,
    average_exit_price: null,
    first_minted_at: 1_781_000_000_000,
    is_up: true,
    last_activity_at: 1_781_010_000_000,
    manager_id: managerId,
    mark_price: 450_000_000,
    mark_value: 450,
    minted_quantity: 1_000,
    open_cost_basis: 420,
    open_quantity: 1_000,
    oracle_id: oracleId,
    predict_id: predictId,
    quote_asset: quoteAsset,
    realized_pnl: 0,
    redeemed_quantity: 0,
    status: 'OPEN',
    strike: 50_000_000_000_000,
    total_cost: 420,
    total_payout: 0,
    underlying_asset: 'BTC',
    unrealized_pnl: 30,
    expiry: 1_781_641_800_000,
    ...overrides,
  };
}

describe('portfolio query hooks', () => {
  beforeEach(() => {
    resetWallet();
  });

  it('loads manager summary with mapped manager balances, PnL, and account fields', async () => {
    const client = createPortfolioClient({
      fetchManagerSummaryDto: vi.fn().mockResolvedValue(managerSummaryDto()),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useManagerSummary({ client, managerId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchManagerSummaryDto).toHaveBeenCalledWith(managerId);
    expect(result.current.data).toMatchObject({
      balanceSummary: {
        accountValueQuote: 1_250n,
        openExposureQuote: 420n,
        realizedPnlQuote: 20n,
        totalManagerBalanceQuote: 750n,
        tradingBalanceQuote: 750n,
        unrealizedPnlQuote: 80n,
      },
      summary: {
        managerId,
        openPositions: 2,
        owner,
      },
    });
    expect(result.current.data?.summary.balances[0]?.quoteAssetType).toBe(`0x${quoteAsset}`);
  });

  it('loads positions summary with normalized binary groups', async () => {
    const client = createPortfolioClient({
      fetchManagerPositionsSummaryDto: vi.fn().mockResolvedValue([
        binaryPositionDto(),
        binaryPositionDto({
          is_up: false,
          mark_value: 200,
          open_quantity: 500,
          strike: 51_000_000_000_000,
          unrealized_pnl: -20,
        }),
      ]),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePositionsSummary({ client, managerId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchManagerPositionsSummaryDto).toHaveBeenCalledWith(managerId);
    expect(result.current.data).toMatchObject({
      binaryPositionCount: 2,
      isEmpty: false,
      managerId,
      openBinaryPositionCount: 2,
      rangePositionCount: 0,
      totalOpenBinaryQuantityQuote: 1_500n,
    });
    expect(result.current.data?.binaryGroups[0]).toMatchObject({
      directions: ['DOWN', 'UP'],
      markValueQuote: 650n,
      openQuantityQuote: 1_500n,
      oracleId,
      positionCount: 2,
      strikes1e9: [50_000_000_000_000n, 51_000_000_000_000n],
    });
  });

  it('keeps queries disabled when no manager is supplied or discovered', () => {
    const client = createPortfolioClient();
    const wrapper = createTestWrapper();

    const { result: summaryResult } = renderHook(() => useManagerSummary({ client }), { wrapper });
    const { result: positionsResult } = renderHook(() => usePositionsSummary({ client }), {
      wrapper,
    });

    expect(summaryResult.current.fetchStatus).toBe('idle');
    expect(positionsResult.current.fetchStatus).toBe('idle');
    expect(client.fetchManagersDto).not.toHaveBeenCalled();
    expect(client.fetchManagerSummaryDto).not.toHaveBeenCalled();
    expect(client.fetchManagerPositionsSummaryDto).not.toHaveBeenCalled();
  });

  it('does not call the adapter client when disabled', () => {
    const client = createPortfolioClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () => usePositionsSummary({ client, enabled: false, managerId }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.fetchManagerPositionsSummaryDto).not.toHaveBeenCalled();
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createPortfolioClient({
      fetchManagerSummaryDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'http-status',
          message: 'Predict server unavailable',
          status: 503,
          url: `https://predict-server.testnet.mystenlabs.com/managers/${managerId}/summary`,
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useManagerSummary({ client, managerId }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        managerId,
        query: 'manager-summary',
      },
      kind: 'transport',
    });
  });
});
