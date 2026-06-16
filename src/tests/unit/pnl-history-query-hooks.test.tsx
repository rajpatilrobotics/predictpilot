import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactionHistory } from '@/features/history/hooks/useTransactionHistory';
import { usePnl } from '@/features/portfolio/hooks/usePnl';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
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
const otherOwner =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756d' as SuiAddress;
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';
const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const packageId = 'f5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

const eventBase = {
  checkpoint: 349_222_343,
  checkpoint_timestamp_ms: 1_781_635_254_964,
  digest: 'digest-a',
  event_digest: 'event-digest-a',
  event_index: 0,
  package: packageId,
  sender: owner,
  tx_index: 0,
};

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

function createPortfolioClient(overrides: Partial<PortfolioReadClient> = {}): PortfolioReadClient {
  return {
    fetchManagerPnlDto: vi.fn(),
    fetchManagerPositionsSummaryDto: vi.fn(),
    fetchManagerSummaryDto: vi.fn(),
    fetchManagersDto: vi.fn(),
    ...overrides,
  };
}

function createHistoryClient(overrides: Partial<HistoryReadClient> = {}): HistoryReadClient {
  return {
    fetchLpSuppliesHistoryDto: vi.fn().mockResolvedValue([]),
    fetchLpWithdrawalsHistoryDto: vi.fn().mockResolvedValue([]),
    fetchOracleTradesDto: vi.fn(),
    fetchPositionMintHistoryDto: vi.fn().mockResolvedValue([]),
    fetchPositionRedeemHistoryDto: vi.fn().mockResolvedValue([]),
    fetchRangeMintHistoryDto: vi.fn().mockResolvedValue([]),
    fetchRangeRedeemHistoryDto: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function binaryMintDto(overrides: Record<string, unknown> = {}) {
  return {
    ...eventBase,
    ask_price: 510_224_076,
    cost: 21_861_452,
    expiry: 1_781_647_200_000,
    is_up: true,
    manager_id: managerId,
    oracle_id: oracleId,
    predict_id: predictId,
    quantity: 42_846_768,
    quote_asset: quoteAsset,
    strike: 65_751_000_000_000,
    trader: owner,
    ...overrides,
  };
}

function rangeMintDto(overrides: Record<string, unknown> = {}) {
  return {
    ...eventBase,
    ask_price: 901_396_381,
    cost: 45_069,
    digest: 'digest-c',
    expiry: 1_781_856_000_000,
    higher_strike: 70_000_000_000_000,
    lower_strike: 62_000_000_000_000,
    manager_id: managerId,
    oracle_id: oracleId,
    predict_id: predictId,
    quantity: 50_000,
    quote_asset: quoteAsset,
    trader: owner,
    ...overrides,
  };
}

function lpSupplyDto(overrides: Record<string, unknown> = {}) {
  return {
    ...eventBase,
    amount: 10_000_000,
    digest: 'digest-e',
    predict_id: predictId,
    quote_asset: quoteAsset,
    shares_minted: 9_981_615,
    supplier: owner,
    ...overrides,
  };
}

function lpWithdrawalDto(overrides: Record<string, unknown> = {}) {
  return {
    ...eventBase,
    amount: 1_100_000,
    digest: 'digest-f',
    predict_id: predictId,
    quote_asset: quoteAsset,
    shares_burned: 1_000_000,
    withdrawer: owner,
    ...overrides,
  };
}

describe('PnL and transaction history hooks', () => {
  beforeEach(() => {
    resetWallet();
  });

  it('loads a populated manager PnL series', async () => {
    const client = createPortfolioClient({
      fetchManagerPnlDto: vi.fn().mockResolvedValue({
        current_total_pnl: -8_444_560,
        current_unrealized_pnl: 3_159_333,
        manager_id: managerId,
        points: [
          {
            cumulative_realized_pnl: 4_972_124,
            realized_pnl: 4_972_124,
            timestamp_ms: 1_781_634_027_154,
          },
        ],
        range: 'ALL',
        series_type: 'realized',
      }),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePnl({ client, managerId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchManagerPnlDto).toHaveBeenCalledWith(managerId, 'ALL');
    expect(result.current.data).toMatchObject({
      currentTotalPnlQuote: -8_444_560n,
      currentUnrealizedPnlQuote: 3_159_333n,
      managerId,
      range: 'ALL',
      seriesType: 'realized',
    });
    expect(result.current.data?.points).toHaveLength(1);
  });

  it('loads an empty manager PnL series without treating it as an error', async () => {
    const client = createPortfolioClient({
      fetchManagerPnlDto: vi.fn().mockResolvedValue([]),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePnl({ client, managerId }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      currentTotalPnlQuote: 0n,
      currentUnrealizedPnlQuote: 0n,
      managerId,
      points: [],
      range: 'ALL',
      seriesType: null,
    });
  });

  it('keeps PnL disabled when no manager is supplied or discovered', () => {
    const client = createPortfolioClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => usePnl({ client }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.fetchManagersDto).not.toHaveBeenCalled();
    expect(client.fetchManagerPnlDto).not.toHaveBeenCalled();
  });

  it('loads populated server-backed transaction history', async () => {
    connectWallet();
    const client = createHistoryClient({
      fetchLpSuppliesHistoryDto: vi
        .fn()
        .mockResolvedValue([
          lpSupplyDto({ checkpoint_timestamp_ms: 1_781_635_280_000 }),
          lpSupplyDto({ supplier: otherOwner }),
        ]),
      fetchLpWithdrawalsHistoryDto: vi
        .fn()
        .mockResolvedValue([lpWithdrawalDto({ checkpoint_timestamp_ms: 1_781_635_270_000 })]),
      fetchPositionMintHistoryDto: vi
        .fn()
        .mockResolvedValue([binaryMintDto({ checkpoint_timestamp_ms: 1_781_635_250_000 })]),
      fetchRangeMintHistoryDto: vi
        .fn()
        .mockResolvedValue([rangeMintDto({ checkpoint_timestamp_ms: 1_781_635_300_000 })]),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useTransactionHistory({ client, managerId, owner }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.fetchPositionMintHistoryDto).toHaveBeenCalledOnce();
    expect(client.fetchPositionRedeemHistoryDto).toHaveBeenCalledOnce();
    expect(client.fetchRangeMintHistoryDto).toHaveBeenCalledOnce();
    expect(client.fetchRangeRedeemHistoryDto).toHaveBeenCalledOnce();
    expect(client.fetchLpSuppliesHistoryDto).toHaveBeenCalledOnce();
    expect(client.fetchLpWithdrawalsHistoryDto).toHaveBeenCalledOnce();
    expect(result.current.data?.records.map((record) => record.kind)).toEqual([
      'RANGE_MINT',
      'LP_SUPPLY',
      'LP_WITHDRAW',
      'BINARY_MINT',
    ]);
    expect(result.current.data?.countsByKind).toMatchObject({
      BINARY_MINT: 1,
      LP_SUPPLY: 1,
      LP_WITHDRAW: 1,
      RANGE_MINT: 1,
    });
  });

  it('loads empty transaction history feeds without treating them as an error', async () => {
    const client = createHistoryClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useTransactionHistory({ client, managerId, owner }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      isEmpty: true,
      latestTimestampMs: null,
      records: [],
      totalCount: 0,
    });
  });

  it('normalizes server failures into PredictPilotError values', async () => {
    const client = createHistoryClient({
      fetchPositionMintHistoryDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'http-status',
          message: 'Predict server unavailable',
          status: 503,
          url: 'https://predict-server.testnet.mystenlabs.com/positions/minted',
        }),
      ),
    });
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useTransactionHistory({ client, managerId, owner }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: {
        managerId,
        owner,
        query: 'history-position-mints',
      },
      kind: 'transport',
    });
  });

  it('does not call history clients when disabled', () => {
    const client = createHistoryClient();
    const wrapper = createTestWrapper();

    const { result } = renderHook(
      () => useTransactionHistory({ client, enabled: false, managerId, owner }),
      { wrapper },
    );

    expect(result.current.isPending).toBe(true);
    expect(client.fetchPositionMintHistoryDto).not.toHaveBeenCalled();
    expect(client.fetchLpSuppliesHistoryDto).not.toHaveBeenCalled();
  });
});
