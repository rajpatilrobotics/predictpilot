import { fireEvent, render, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import { MarketDetailPage } from '@/features/trade/MarketDetailPage';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { ManagerPositionsSummaryModel, ManagerSummaryModel } from '@/types/portfolio';

vi.mock('@/features/wallet/useWalletStatus', () => ({
  useWalletStatus: vi.fn(),
}));

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: vi.fn(),
}));

vi.mock('@/features/markets/hooks/useOracleState', () => ({
  useOracleState: vi.fn(),
}));

vi.mock('@/features/markets/hooks/useAskBounds', () => ({
  useAskBounds: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: vi.fn(),
}));

const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const oracleCapId =
  '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817' as ObjectId;
const managerId = '0x2c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const nowMs = 1_781_635_255_000;

interface HookState {
  askBounds: UseQueryResult<OracleAskBoundsModel, PredictPilotError>;
  manager: UsePredictManagerResult;
  managerSummary: UseQueryResult<ManagerSummaryPortfolioModel, PredictPilotError>;
  oracleState: UseQueryResult<OracleStateModel, PredictPilotError>;
  positionsSummary: UseQueryResult<ReturnType<typeof createPositionsSummary>, PredictPilotError>;
  wallet: WalletStatusModel;
}

const hookState: HookState = {
  askBounds: querySuccess<OracleAskBoundsModel>({ status: 'PRESENT_UNMAPPED' }),
  manager: createManagerState(),
  managerSummary: querySuccess(createManagerSummaryPortfolio()),
  oracleState: querySuccess(createOracleState()),
  positionsSummary: querySuccess(createPositionsSummary()),
  wallet: createWalletStatus(),
};

beforeEach(() => {
  hookState.askBounds = querySuccess<OracleAskBoundsModel>({ status: 'PRESENT_UNMAPPED' });
  hookState.manager = createManagerState();
  hookState.managerSummary = querySuccess(createManagerSummaryPortfolio());
  hookState.oracleState = querySuccess(createOracleState());
  hookState.positionsSummary = querySuccess(createPositionsSummary());
  hookState.wallet = createWalletStatus();

  vi.mocked(useWalletStatus).mockImplementation(() => hookState.wallet);
  vi.mocked(usePredictManager).mockImplementation(() => hookState.manager);
  vi.mocked(useOracleState).mockImplementation(() => hookState.oracleState);
  vi.mocked(useAskBounds).mockImplementation(() => hookState.askBounds);
  vi.mocked(useManagerSummary).mockImplementation(() => hookState.managerSummary);
  vi.mocked(usePositionsSummary).mockImplementation(() => hookState.positionsSummary);
});

describe('MarketDetailPage and StrategyBuilder', () => {
  it('shows a safe strategy state when no market is selected', () => {
    render(<MarketDetailPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Market Detail / Strategy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Strategy builder empty state' })).toHaveTextContent(
      'Select a market first',
    );
    expect(useOracleState).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('renders focused market detail and blocks valid binary input at the TODO VERIFY estimator boundary', async () => {
    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    expect(screen.getByRole('heading', { name: 'Market Detail / Strategy' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Strategy builder' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('status', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('TODO VERIFY / simulation required');
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('validates binary quantity before any signing flow exists', async () => {
    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    fireEvent.change(screen.getByLabelText('Quantity (DUSDC atomic)'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('Binary trade quantity must be greater than zero.');
  });

  it('validates range strike order distinctly from binary mode', async () => {
    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Range' }));
    fireEvent.change(screen.getByLabelText('Higher strike'), {
      target: { value: '50000000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('Range strike inputs are invalid for this oracle.');
  });

  it('surfaces wallet and manager blockers without signing controls', () => {
    hookState.wallet = createWalletStatus({
      accountAddress: null,
      isConnected: false,
      isDisconnected: true,
      shortAddress: null,
      status: 'disconnected',
      statusLabel: 'Disconnected',
    });
    hookState.manager = createManagerState({
      authoritativeObject: null,
      isReady: false,
      manager: null,
      managerId: null,
      owner: null,
      status: 'NO_WALLET',
    });

    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    expect(screen.getByText(/Connect wallet before any future signing flow/i)).toBeInTheDocument();
    expect(screen.getByText(/PredictManager is not ready/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces wrong-network state before future execution wiring', () => {
    hookState.wallet = createWalletStatus({
      currentNetwork: 'mainnet',
      isExpectedNetwork: false,
      isWrongNetwork: true,
    });

    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    expect(screen.getByText(/Wrong network/i)).toBeInTheDocument();
    expect(screen.getByText(/Switch from mainnet to testnet/i)).toBeInTheDocument();
  });

  it('blocks stale oracle previews with protocol-safe copy', async () => {
    hookState.oracleState = querySuccess(
      createOracleState({
        priceTimestampMs: nowMs - 90_000,
        sviTimestampMs: nowMs - 90_000,
      }),
    );

    render(<MarketDetailPage nowMs={nowMs} oracleId={oracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('The selected oracle data is stale.');
  });

  it('does not call read hooks for invalid dynamic route IDs', () => {
    render(<MarketDetailPage oracleId="0x123" />);

    expect(screen.getByRole('alert', { name: 'Invalid oracle route' })).toHaveTextContent(
      'No Predict server request was made',
    );
    expect(useOracleState).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });
});

function createOracleState({
  lifecycleStatus = 'ACTIVE',
  priceTimestampMs = nowMs - 1_000,
  sviTimestampMs = nowMs - 2_000,
}: {
  lifecycleStatus?: OracleStateModel['oracle']['lifecycleStatus'];
  priceTimestampMs?: number;
  sviTimestampMs?: number;
} = {}): OracleStateModel {
  return {
    askBounds: { status: 'PRESENT_UNMAPPED' },
    latestPrice: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(priceTimestampMs),
      digest: 'price-digest',
      eventDigest: 'price-event',
      eventIndex: 0,
      forward1e9: 65_500_000_000_000n,
      onchainTimestampMs: BigInt(priceTimestampMs),
      oracleId,
      packageId: predictDeploymentConfig.packageId,
      sender: owner,
      spot1e9: 65_250_000_000_000n,
      txIndex: 0,
    },
    latestSvi: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(sviTimestampMs),
      digest: 'svi-digest',
      eventDigest: 'svi-event',
      eventIndex: 0,
      onchainTimestampMs: BigInt(sviTimestampMs),
      oracleId,
      packageId: predictDeploymentConfig.packageId,
      sender: owner,
      svi: {
        a1e9: 1_000_000_000n,
        b1e9: 2_000_000_000n,
        m1e9Signed: 0n,
        rho1e9Signed: 0n,
        sigma1e9: 500_000_000n,
      },
      txIndex: 0,
    },
    oracle: {
      activatedAtMs: BigInt(nowMs - 5_000),
      createdCheckpoint: 1n,
      expiryMs: BigInt(nowMs + 3_600_000),
      lifecycleStatus,
      minStrike1e9: 50_000_000_000_000n,
      oracleCapId,
      oracleId,
      predictId: predictDeploymentConfig.predictObjectId,
      settlementPrice1e9: null,
      settledAtMs: null,
      tickSize1e9: 1_000_000_000n,
      underlyingAsset: 'BTC',
    },
  };
}

function createManagerSummaryPortfolio(): ManagerSummaryPortfolioModel {
  const summary: ManagerSummaryModel = {
    accountValueQuote: 5_000_000n,
    awaitingSettlementPositions: 0,
    balances: [
      {
        balanceQuote: 5_000_000n,
        quoteAssetType: predictDeploymentConfig.quoteAsset.type,
      },
    ],
    lastRefreshedAtMs: BigInt(nowMs),
    managerId,
    openExposureQuote: 0n,
    openPositions: 0,
    owner,
    realizedPnlQuote: 0n,
    redeemableValueQuote: 0n,
    tradingBalanceQuote: 5_000_000n,
    unrealizedPnlQuote: 0n,
  };

  return {
    balanceSummary: {
      accountValueQuote: summary.accountValueQuote,
      awaitingSettlementPositions: summary.awaitingSettlementPositions,
      balances: summary.balances,
      managerId,
      openExposureQuote: summary.openExposureQuote,
      openPositions: summary.openPositions,
      owner,
      realizedPnlQuote: summary.realizedPnlQuote,
      redeemableValueQuote: summary.redeemableValueQuote,
      totalManagerBalanceQuote: summary.tradingBalanceQuote,
      tradingBalanceQuote: summary.tradingBalanceQuote,
      unrealizedPnlQuote: summary.unrealizedPnlQuote,
    },
    summary,
  };
}

function createPositionsSummary() {
  const summary: ManagerPositionsSummaryModel = {
    binaryPositions: [],
    managerId,
    rangePositions: [],
  };

  return {
    binaryGroups: [],
    binaryPositionCount: 0,
    isEmpty: true,
    managerId,
    openBinaryPositionCount: 0,
    openRangePositionCount: 0,
    rangeGroups: [],
    rangePositionCount: 0,
    summary,
    totalOpenBinaryQuantityQuote: 0n,
    totalOpenRangeQuantityQuote: 0n,
  };
}

function createManagerState(
  overrides: Partial<UsePredictManagerResult> = {},
): UsePredictManagerResult {
  return {
    authoritativeObject: {
      digest: 'manager-digest',
      id: managerId,
      json: null,
      network: 'testnet',
      owner,
      previousTransaction: null,
      type: 'predict_manager::PredictManager',
      version: '1',
    },
    error: null,
    isAmbiguous: false,
    isConfirming: false,
    isLoading: false,
    isReady: true,
    manager: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(nowMs),
      digest: 'manager-created-digest',
      eventDigest: 'manager-created-event',
      eventIndex: 0,
      managerId,
      owner,
      packageId: predictDeploymentConfig.packageId,
      sender: owner,
      txIndex: 0,
    },
    managerId,
    matchingManagers: [],
    owner,
    requiresCreateManager: false,
    status: 'READY',
    warnings: [],
    ...overrides,
  };
}

function createWalletStatus(overrides: Partial<WalletStatusModel> = {}): WalletStatusModel {
  return {
    accountAddress: owner,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: '0x195b...56c',
    status: 'connected',
    statusLabel: 'Connected',
    supportedIntentsCount: 1,
    walletName: 'Test Wallet',
    ...overrides,
  };
}

function querySuccess<T>(data: T): UseQueryResult<T, PredictPilotError> {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
  } as unknown as UseQueryResult<T, PredictPilotError>;
}
