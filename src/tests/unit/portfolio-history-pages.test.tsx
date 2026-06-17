import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from '@/features/history/HistoryPage';
import type { UseTransactionHistoryResult } from '@/features/history/hooks/useTransactionHistory';
import { PnlPage } from '@/features/portfolio/PnlPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import type { TransactionHistoryTimelineModel } from '@/features/history/lib/history-selectors';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type {
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { PredictPilotError } from '@/lib/errors';
import type { ManagerPnlModel, PredictManagerCreatedModel } from '@/types/portfolio';
import type { ObjectId, SuiAddress } from '@/types/predict';

const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const alternateManagerId =
  '0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a' as ObjectId;
const quoteAsset =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC' as const;

interface MockQueryResult<TData> {
  data: TData | undefined;
  error: PredictPilotError | null;
  isLoading: boolean;
  isPending: boolean;
}

interface HookState {
  history: UseTransactionHistoryResult;
  manager: UsePredictManagerResult;
  managerSummary: MockQueryResult<ManagerSummaryPortfolioModel>;
  pnl: MockQueryResult<ManagerPnlModel>;
  positionsSummary: MockQueryResult<NormalizedManagerPositionsSummaryModel>;
  wallet: WalletStatusModel;
}

const hookState = vi.hoisted(
  (): HookState => ({
  history: {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    refetch: vi.fn(),
  },
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
    isLoading: false,
    isPending: false,
  },
  pnl: {
    data: undefined,
    error: null,
    isLoading: false,
    isPending: false,
  },
  positionsSummary: {
    data: undefined,
    error: null,
    isLoading: false,
    isPending: false,
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

vi.mock('@/features/wallet/useWalletStatus', () => ({
  useWalletStatus: () => hookState.wallet,
}));

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: () => hookState.manager,
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: () => hookState.managerSummary,
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: () => hookState.positionsSummary,
}));

vi.mock('@/features/portfolio/hooks/usePnl', () => ({
  usePnl: () => hookState.pnl,
}));

vi.mock('@/features/history/hooks/useTransactionHistory', () => ({
  useTransactionHistory: () => hookState.history,
}));

describe('portfolio, PnL, and history pages', () => {
  beforeEach(() => {
    resetHookState();
  });

  it('shows the disconnected state before loading portfolio data', () => {
    render(<PortfolioPage />);

    expect(screen.getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Connect wallet to view portfolio' })).toBeInTheDocument();
  });

  it('shows the no-manager state', () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      isReady: false,
      managerId: null,
      requiresCreateManager: true,
      status: 'NO_MANAGER',
    };

    render(<PortfolioPage />);

    expect(screen.getByRole('status', { name: 'No PredictManager found' })).toBeInTheDocument();
  });

  it('shows the ambiguous-manager state without selecting a manager', () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      isAmbiguous: true,
      isReady: false,
      managerId: null,
      matchingManagers: [
        managerCreated(managerId),
        managerCreated(alternateManagerId),
      ],
      status: 'AMBIGUOUS',
    };

    render(<HistoryPage />);

    expect(screen.getByRole('status', { name: 'Ambiguous PredictManager' })).toBeInTheDocument();
    expect(screen.getByText(managerId)).toBeInTheDocument();
    expect(screen.getByText(alternateManagerId)).toBeInTheDocument();
  });

  it('shows a manager loading state', () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      isLoading: true,
      isReady: false,
      managerId: null,
      status: 'LOADING',
    };

    render(<PnlPage />);

    expect(screen.getByRole('status', { name: 'Loading PredictManager' })).toBeInTheDocument();
  });

  it('shows a safe error state', () => {
    connectWallet();
    hookState.manager = {
      ...baseManager(),
      error: appError('Predict server unavailable'),
      isReady: false,
      managerId: null,
      status: 'ERROR',
    };

    render(<HistoryPage />);

    expect(screen.getByRole('alert', { name: 'History manager lookup failed' })).toHaveTextContent(
      'Predict server unavailable',
    );
  });

  it('renders an empty portfolio without merging wallet and manager balances', () => {
    setReadyManager();
    hookState.managerSummary = querySuccess(managerSummary());
    hookState.positionsSummary = querySuccess(emptyPositionsSummary());

    render(<PortfolioPage />);

    expect(screen.getByText('Wallet dUSDC balance not loaded in this lane')).toBeInTheDocument();
    expect(screen.getByText('125 dUSDC')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'No open positions' })).toBeInTheDocument();
  });

  it('renders portfolio success cards and manager-backed position tables', () => {
    setReadyManager();
    hookState.managerSummary = querySuccess(managerSummary());
    hookState.positionsSummary = querySuccess(populatedPositionsSummary());

    render(<PortfolioPage />);

    expect(screen.getByText('Manager dUSDC')).toBeInTheDocument();
    expect(screen.getByText('Held inside PredictManager')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Binary positions' })).toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('65,000.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Range positions' })).toBeInTheDocument();
    expect(screen.getByText(/62,000.00-70,000.00/)).toBeInTheDocument();
  });

  it('renders empty PnL as a successful empty state', () => {
    setReadyManager();
    hookState.pnl = querySuccess({
      currentTotalPnlQuote: 0n,
      currentUnrealizedPnlQuote: 0n,
      managerId,
      points: [],
      range: 'ALL',
      seriesType: null,
    });

    render(<PnlPage />);

    expect(screen.getByText('Current total PnL')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'No PnL points' })).toBeInTheDocument();
  });

  it('renders PnL chart and point table when data exists', () => {
    setReadyManager();
    hookState.pnl = querySuccess(pnlSeries());

    render(<PnlPage />);

    expect(screen.getByRole('img', { name: 'Manager PnL chart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PnL points' })).toBeInTheDocument();
    expect(screen.getAllByText('0.9 dUSDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.3 dUSDC').length).toBeGreaterThan(0);
  });

  it('renders empty history without fabricating rows', () => {
    setReadyManager();
    hookState.history = historySuccess(emptyHistory());

    render(<HistoryPage />);

    expect(screen.getByRole('status', { name: 'No history yet' })).toBeInTheDocument();
  });

  it('renders grouped history rows with digest links', () => {
    setReadyManager();
    hookState.history = historySuccess(populatedHistory());

    render(<HistoryPage />);

    expect(screen.getByRole('heading', { name: 'Binary Minted' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Range Minted' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LP Supplies' })).toBeInTheDocument();
    expect(screen.getByText('Binary mint')).toBeInTheDocument();
    expect(screen.getByText(/65,000.00/)).toBeInTheDocument();
    expect(screen.getByText('9,981,615 PLP')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View transaction digest-a on Sui Explorer' }),
    ).toBeInTheDocument();

    const rangeSection = screen.getByRole('heading', { name: 'Range Minted' }).closest('section');
    expect(rangeSection).not.toBeNull();
    expect(within(rangeSection as HTMLElement).getByText(/62,000.00-70,000.00/)).toBeInTheDocument();
  });
});

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
  hookState.pnl = queryIdle();
  hookState.history = {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    refetch: vi.fn(),
  };
}

function connectWallet() {
  hookState.wallet = {
    accountAddress: owner,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: '0x195b...756c',
    status: 'connected',
    statusLabel: 'Connected',
    supportedIntentsCount: 1,
    walletName: 'Slush',
  };
}

function setReadyManager() {
  connectWallet();
  hookState.manager = baseManager();
}

function baseManager(): UsePredictManagerResult {
  return {
    authoritativeObject: {
      digest: 'object-digest',
      id: managerId,
      json: null,
      network: 'testnet' as const,
      owner,
      previousTransaction: null,
      type: 'deepbook_predict::predict_manager::PredictManager',
      version: '1',
    },
    error: null,
    isAmbiguous: false,
    isConfirming: false,
    isLoading: false,
    isReady: true,
    manager: managerCreated(managerId),
    managerId,
    matchingManagers: [],
    owner,
    requiresCreateManager: false,
    status: 'READY',
    warnings: [],
  };
}

function managerCreated(selectedManagerId: ObjectId): PredictManagerCreatedModel {
  return {
    checkpoint: 1n,
    checkpointTimestampMs: 1_781_635_250_000n,
    digest: 'manager-create-digest',
    eventDigest: 'manager-event-digest',
    eventIndex: 0,
    managerId: selectedManagerId,
    owner,
    packageId: predictId,
    sender: owner,
    txIndex: 0,
  };
}

function queryIdle() {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isPending: false,
  };
}

function querySuccess<T>(data: T) {
  return {
    data,
    error: null,
    isLoading: false,
    isPending: false,
  };
}

function historySuccess(data: TransactionHistoryTimelineModel) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}

function appError(message: string): PredictPilotError {
  return {
    code: 'PREDICT_SERVER_UNAVAILABLE',
    context: {},
    debugId: 'debug-test',
    kind: 'transport',
    message,
    recovery: 'Retry the request.',
    retryable: true,
    severity: 'error',
    title: 'Predict server unavailable',
  };
}

function managerSummary(): ManagerSummaryPortfolioModel {
  return {
    balanceSummary: {
      accountValueQuote: 210_000_000n,
      awaitingSettlementPositions: 1,
      balances: [
        {
          balanceQuote: 125_000_000n,
          quoteAssetType: quoteAsset,
        },
      ],
      managerId,
      openExposureQuote: 75_000_000n,
      openPositions: 2,
      owner,
      realizedPnlQuote: 12_500_000n,
      redeemableValueQuote: 15_000_000n,
      totalManagerBalanceQuote: 125_000_000n,
      tradingBalanceQuote: 100_000_000n,
      unrealizedPnlQuote: 3_000_000n,
    },
    summary: {
      accountValueQuote: 210_000_000n,
      awaitingSettlementPositions: 1,
      balances: [
        {
          balanceQuote: 125_000_000n,
          quoteAssetType: quoteAsset,
        },
      ],
      lastRefreshedAtMs: null,
      managerId,
      openExposureQuote: 75_000_000n,
      openPositions: 2,
      owner,
      realizedPnlQuote: 12_500_000n,
      redeemableValueQuote: 15_000_000n,
      tradingBalanceQuote: 100_000_000n,
      unrealizedPnlQuote: 3_000_000n,
    },
  };
}

function emptyPositionsSummary(): NormalizedManagerPositionsSummaryModel {
  return {
    binaryGroups: [],
    binaryPositionCount: 0,
    isEmpty: true,
    managerId,
    openBinaryPositionCount: 0,
    openRangePositionCount: 0,
    rangeGroups: [],
    rangePositionCount: 0,
    summary: {
      binaryPositions: [],
      managerId,
      rangePositions: [],
    },
    totalOpenBinaryQuantityQuote: 0n,
    totalOpenRangeQuantityQuote: 0n,
  };
}

function populatedPositionsSummary(): NormalizedManagerPositionsSummaryModel {
  return {
    ...emptyPositionsSummary(),
    binaryGroups: [
      {
        directions: ['UP'],
        expiryMs: 1_781_856_000_000n,
        groupKey: `${oracleId}:1781856000000`,
        lastActivityAtMs: 1_781_635_300_000n,
        markValueQuote: 66_000_000n,
        mintedQuantityQuote: 80_000_000n,
        openCostBasisQuote: 42_000_000n,
        openQuantityQuote: 50_000_000n,
        oracleId,
        positionCount: 1,
        positions: [],
        realizedPnlQuote: 5_000_000n,
        redeemedQuantityQuote: 30_000_000n,
        strikes1e9: [65_000_000_000_000n],
        underlyingAsset: 'BTC',
        unrealizedPnlQuote: 2_000_000n,
      },
    ],
    binaryPositionCount: 1,
    isEmpty: false,
    openBinaryPositionCount: 1,
    openRangePositionCount: 1,
    rangeGroups: [
      {
        expiryMs: 1_781_856_000_000n,
        groupKey: `${oracleId}:1781856000000`,
        oracleId,
        positionCount: 1,
        positions: [
          {
            key: {
              expiryMs: 1_781_856_000_000n,
              higherStrike1e9: 70_000_000_000_000n,
              lowerStrike1e9: 62_000_000_000_000n,
              oracleId,
            },
            quantityQuote: 25_000_000n,
          },
        ],
        totalQuantityQuote: 25_000_000n,
      },
    ],
    rangePositionCount: 1,
    totalOpenBinaryQuantityQuote: 50_000_000n,
    totalOpenRangeQuantityQuote: 25_000_000n,
  };
}

function pnlSeries(): ManagerPnlModel {
  return {
    currentTotalPnlQuote: 900_000n,
    currentUnrealizedPnlQuote: 300_000n,
    managerId,
    points: [
      {
        pnlQuote: -200_000n,
        realizedPnlQuote: -200_000n,
        timestampMs: 1_781_635_250_000n,
      },
      {
        equityQuote: 1_300_000n,
        pnlQuote: 900_000n,
        realizedPnlQuote: 600_000n,
        timestampMs: 1_781_635_300_000n,
        unrealizedPnlQuote: 300_000n,
      },
    ],
    range: 'ALL',
    seriesType: 'realized',
  };
}

function emptyHistory(): TransactionHistoryTimelineModel {
  return {
    countsByKind: {
      BINARY_MINT: 0,
      BINARY_REDEEM: 0,
      LP_SUPPLY: 0,
      LP_WITHDRAW: 0,
      ORACLE_TRADE: 0,
      RANGE_MINT: 0,
      RANGE_REDEEM: 0,
    },
    feeds: {
      lpSupplies: [],
      lpWithdrawals: [],
      positionMints: [],
      positionRedeems: [],
      rangeMints: [],
      rangeRedeems: [],
    },
    isEmpty: true,
    latestTimestampMs: null,
    managerId,
    owner,
    records: [],
    totalCount: 0,
  };
}

function populatedHistory(): TransactionHistoryTimelineModel {
  const binaryMint = {
    askPrice1e9: 510_000_000n,
    costQuote: 12_000_000n,
    digest: 'digest-a',
    eventIndex: 0,
    key: {
      direction: 'UP' as const,
      expiryMs: 1_781_856_000_000n,
      oracleId,
      strike1e9: 65_000_000_000_000n,
    },
    kind: 'BINARY_MINT' as const,
    managerId,
    predictId,
    quantityQuote: 20_000_000n,
    quoteAssetType: quoteAsset,
    timestampMs: 1_781_635_250_000n,
    trader: owner,
  };
  const rangeMint = {
    costQuote: 10_000_000n,
    digest: 'digest-b',
    eventIndex: 0,
    key: {
      expiryMs: 1_781_856_000_000n,
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracleId,
    },
    kind: 'RANGE_MINT' as const,
    managerId,
    predictId,
    quantityQuote: 10_000_000n,
    quoteAssetType: quoteAsset,
    timestampMs: 1_781_635_300_000n,
    trader: owner,
  };
  const lpSupply = {
    digest: 'digest-c',
    eventIndex: 0,
    kind: 'LP_SUPPLY' as const,
    mintedPlpAtomic: 9_981_615n,
    predictId,
    provider: owner,
    quoteAssetType: quoteAsset,
    suppliedQuote: 10_000_000n,
    timestampMs: 1_781_635_280_000n,
  };

  return {
    countsByKind: {
      BINARY_MINT: 1,
      BINARY_REDEEM: 0,
      LP_SUPPLY: 1,
      LP_WITHDRAW: 0,
      ORACLE_TRADE: 0,
      RANGE_MINT: 1,
      RANGE_REDEEM: 0,
    },
    feeds: {
      lpSupplies: [lpSupply],
      lpWithdrawals: [],
      positionMints: [binaryMint],
      positionRedeems: [],
      rangeMints: [rangeMint],
      rangeRedeems: [],
    },
    isEmpty: false,
    latestTimestampMs: 1_781_635_300_000n,
    managerId,
    owner,
    records: [rangeMint, lpSupply, binaryMint],
    totalCount: 3,
  };
}
