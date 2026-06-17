import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type {
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import type { OracleSummaryModel } from '@/types/oracle';
import type { ObjectId, PredictStateModel, SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

type DashboardQueryMock<TData> = {
  data: TData | undefined;
  error: PredictPilotError | null;
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
};

const hookState = vi.hoisted(
  (): {
    manager: UsePredictManagerResult;
    managerSummary: DashboardQueryMock<ManagerSummaryPortfolioModel>;
    oracles: DashboardQueryMock<OracleSummaryModel[]>;
    positions: DashboardQueryMock<NormalizedManagerPositionsSummaryModel>;
    predictState: DashboardQueryMock<PredictStateModel>;
    vault: DashboardQueryMock<VaultModel>;
    wallet: WalletStatusModel;
  } => ({
    manager: createManagerState(),
    managerSummary: emptyQuery(),
    oracles: emptyQuery(),
    positions: emptyQuery(),
    predictState: emptyQuery(),
    vault: emptyQuery(),
    wallet: createWalletState(),
  }),
);

vi.mock('@/features/wallet/useWalletStatus', () => ({
  useWalletStatus: () => hookState.wallet,
}));

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: () => hookState.manager,
}));

vi.mock('@/features/markets/hooks/usePredictState', () => ({
  usePredictState: () => hookState.predictState,
}));

vi.mock('@/features/markets/hooks/usePredictOracles', () => ({
  usePredictOracles: () => hookState.oracles,
}));

vi.mock('@/features/vault/hooks/useVaultSummary', () => ({
  useVaultSummary: () => hookState.vault,
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: () => hookState.managerSummary,
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: () => hookState.positions,
}));

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a' as ObjectId;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;

describe('DashboardPage', () => {
  beforeEach(() => {
    hookState.wallet = createWalletState();
    hookState.manager = createManagerState();
    hookState.predictState = successQuery(createPredictState());
    hookState.oracles = successQuery([]);
    hookState.vault = emptyQuery();
    hookState.managerSummary = emptyQuery();
    hookState.positions = emptyQuery();
  });

  it('renders loading skeletons while dashboard read hooks are pending', () => {
    hookState.predictState = loadingQuery();
    hookState.oracles = loadingQuery();
    hookState.vault = loadingQuery();

    render(<DashboardPage />);

    expect(screen.getByRole('status', { name: /Dashboard loading state/i })).toBeInTheDocument();
    expect(screen.getByText('Market status')).toBeInTheDocument();
    expect(screen.getByText('Manager readiness')).toBeInTheDocument();
    expect(screen.getByText('Vault snapshot')).toBeInTheDocument();
  });

  it('shows disconnected and no-manager states without execution controls', () => {
    hookState.manager = createManagerState({ status: 'NO_WALLET' });

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('No wallet').length).toBeGreaterThan(0);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText(/No markets indexed yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign|execute/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/transaction digest/i)).not.toBeInTheDocument();
  });

  it('renders market, vault, manager, and portfolio summary data', () => {
    hookState.wallet = createWalletState({ isConnected: true, isDisconnected: false, status: 'connected' });
    hookState.manager = createManagerState({
      isReady: true,
      managerId,
      owner,
      status: 'READY',
    });
    hookState.oracles = successQuery([
      createOracle({ lifecycleStatus: 'ACTIVE', oracleId, underlyingAsset: 'BTC' }),
      createOracle({
        lifecycleStatus: 'SETTLED',
        oracleId: '0x1c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d',
        underlyingAsset: 'ETH',
      }),
    ]);
    hookState.vault = successQuery(createVault());
    hookState.managerSummary = successQuery(createManagerSummary());
    hookState.positions = successQuery(createPositionsSummary());

    render(<DashboardPage />);

    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('SETTLED')).toBeInTheDocument();
    expect(screen.getAllByText('1.25 dUSDC').length).toBeGreaterThan(0);
    expect(screen.getByText('12.50%')).toBeInTheDocument();
    expect(screen.getByText('Vault / PLP Snapshot')).toBeInTheDocument();
    expect(screen.getByText('1.004200')).toBeInTheDocument();
    expect(screen.getByText('Build Trade')).toBeInTheDocument();
  });

  it('shows honest empty states for no indexed markets and no open positions', () => {
    hookState.wallet = createWalletState({ isConnected: true, isDisconnected: false, status: 'connected' });
    hookState.manager = createManagerState({
      isReady: true,
      managerId,
      owner,
      status: 'READY',
    });
    hookState.oracles = successQuery([]);
    hookState.positions = successQuery(createPositionsSummary({ isEmpty: true }));

    render(<DashboardPage />);

    expect(screen.getByText(/No markets indexed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No open positions yet/i)).toBeInTheDocument();
  });

  it('renders PredictPilotError panels from failed read hooks', () => {
    hookState.oracles = errorQuery({
      code: 'PREDICT_SERVER_UNAVAILABLE',
      context: { query: 'predict-oracles' },
      debugId: 'debug-dashboard-oracles',
      kind: 'transport',
      message: 'Predict server unavailable.',
      recovery: 'Retry the dashboard read.',
      retryable: true,
      severity: 'warning',
      title: 'Predict server unavailable',
    });

    render(<DashboardPage />);

    const errors = screen.getByLabelText('Dashboard read errors');
    expect(within(errors).getByRole('alert')).toHaveTextContent(
      'Oracle list: Predict server unavailable',
    );
    expect(within(errors).getByText('Retry the dashboard read.')).toBeInTheDocument();
  });
});

function successQuery<TData>(data: TData): DashboardQueryMock<TData> {
  return {
    data,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
  };
}

function loadingQuery<TData>(): DashboardQueryMock<TData> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isLoading: true,
    isPending: true,
    isSuccess: false,
  };
}

function emptyQuery<TData>(): DashboardQueryMock<TData> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
  };
}

function errorQuery<TData>(error: PredictPilotError): DashboardQueryMock<TData> {
  return {
    data: undefined,
    error,
    isError: true,
    isLoading: false,
    isPending: false,
    isSuccess: false,
  };
}

function createWalletState(overrides: Partial<WalletStatusModel> = {}): WalletStatusModel {
  return {
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
    ...overrides,
  };
}

function createManagerState(
  overrides: Partial<UsePredictManagerResult> = {},
): UsePredictManagerResult {
  return {
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
    ...overrides,
  };
}

function createPredictState(): PredictStateModel {
  return {
    predictId,
    pricingStatus: 'PRESENT',
    quoteAssets: [],
    riskStatus: 'PRESENT',
    tradingPaused: false,
  };
}

function createOracle(overrides: Partial<OracleSummaryModel> = {}): OracleSummaryModel {
  return {
    activatedAtMs: 1_781_634_686_445n,
    createdCheckpoint: 349_219_640n,
    expiryMs: 1_781_641_800_000n,
    lifecycleStatus: 'ACTIVE',
    minStrike1e9: 50_000_000_000_000n,
    oracleCapId: '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817',
    oracleId,
    predictId,
    settlementPrice1e9: null,
    settledAtMs: null,
    tickSize1e9: 1_000_000_000n,
    underlyingAsset: 'BTC',
    ...overrides,
  };
}

function createVault(): VaultModel {
  return {
    assetBalanceQuote: 2_000_000_000n,
    availableLiquidityQuote: 1_200_000_000n,
    availableWithdrawalQuote: 700_000_000n,
    lastRefreshedAtMs: 100_000n,
    maxPayoutUtilizationRatio: 0.2,
    netDepositsQuote: 1_100_000_000n,
    plpSharePrice: 1.0042,
    plpTotalSupplyAtomic: 5_000_000_000n,
    predictId,
    quoteAssetType: '0xabc::dusdc::DUSDC',
    quoteAssetTypes: ['0xabc::dusdc::DUSDC'],
    totalMaxPayoutQuote: 300_000_000n,
    totalMtmQuote: 20_000_000n,
    totalSuppliedQuote: 2_500_000_000n,
    totalWithdrawnQuote: 100_000_000n,
    utilizationRatio: 0.125,
    vaultBalanceQuote: 2_000_000_000n,
    vaultValueQuote: 2_125_000_000n,
  };
}

function createManagerSummary(): ManagerSummaryPortfolioModel {
  return {
    balanceSummary: {
      accountValueQuote: 1_750_000n,
      awaitingSettlementPositions: 0,
      balances: [],
      managerId,
      openExposureQuote: 500_000n,
      openPositions: 3,
      owner,
      realizedPnlQuote: 125_000n,
      redeemableValueQuote: 0n,
      totalManagerBalanceQuote: 1_250_000n,
      tradingBalanceQuote: 1_250_000n,
      unrealizedPnlQuote: 50_000n,
    },
    summary: {
      accountValueQuote: 1_750_000n,
      awaitingSettlementPositions: 0,
      balances: [],
      lastRefreshedAtMs: 100_000n,
      managerId,
      openExposureQuote: 500_000n,
      openPositions: 3,
      owner,
      realizedPnlQuote: 125_000n,
      redeemableValueQuote: 0n,
      tradingBalanceQuote: 1_250_000n,
      unrealizedPnlQuote: 50_000n,
    },
  };
}

function createPositionsSummary(
  overrides: Partial<NormalizedManagerPositionsSummaryModel> = {},
): NormalizedManagerPositionsSummaryModel {
  return {
    binaryGroups: [],
    binaryPositionCount: 2,
    isEmpty: false,
    managerId,
    openBinaryPositionCount: 2,
    openRangePositionCount: 1,
    rangeGroups: [],
    rangePositionCount: 1,
    summary: {
      binaryPositions: [],
      managerId,
      rangePositions: [],
    },
    totalOpenBinaryQuantityQuote: 2_000_000n,
    totalOpenRangeQuantityQuote: 1_000_000n,
    ...overrides,
  };
}
