import { fireEvent, render, screen, within } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketIntelligencePage } from '@/features/markets/MarketIntelligencePage';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import { usePredictState } from '@/features/markets/hooks/usePredictState';
import {
  ORACLE_LIVE_TAPE_SOURCE,
  useLiveOracleTape,
  type LiveOracleTapeModel,
} from '@/features/oracle/hooks/useLiveOracleTape';
import type * as LiveOracleTapeModule from '@/features/oracle/hooks/useLiveOracleTape';
import type { PredictPilotError } from '@/lib/errors';
import type {
  OracleAskBoundsModel,
  OracleIndexedPriceModel,
  OracleIndexedSviModel,
  OracleStateModel,
  OracleSummaryModel,
} from '@/types/oracle';
import type { ObjectId, PredictStateModel, SuiAddress } from '@/types/predict';

vi.mock('@/features/markets/hooks/useAskBounds', () => ({
  useAskBounds: vi.fn(),
}));

vi.mock('@/features/markets/hooks/useOracleState', () => ({
  useOracleState: vi.fn(),
}));

vi.mock('@/features/markets/hooks/usePredictOracles', () => ({
  usePredictOracles: vi.fn(),
}));

vi.mock('@/features/markets/hooks/usePredictState', () => ({
  usePredictState: vi.fn(),
}));

vi.mock('@/features/oracle/hooks/useLiveOracleTape', async () => {
  const actual = await vi.importActual<typeof LiveOracleTapeModule>(
    '@/features/oracle/hooks/useLiveOracleTape',
  );

  return {
    ...actual,
    useLiveOracleTape: vi.fn(),
  };
});

const nowMs = 1_781_635_255_000;
const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a' as ObjectId;
const btcOracleId =
  '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const ethOracleId =
  '0xa12da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const packageId = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138' as ObjectId;
const sender = '0xcca26f7ae2e40604498294e95bacccc4652cc8cb2aa074d7ee608c7e7bdf0c29' as SuiAddress;

const predictState: PredictStateModel = {
  predictId,
  pricingStatus: 'MISSING',
  quoteAssets: ['0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'],
  riskStatus: 'PRESENT',
  tradingPaused: false,
};

const btcOracle = createOracleSummary({
  lifecycleStatus: 'ACTIVE',
  oracleId: btcOracleId,
  underlyingAsset: 'BTC',
});
const ethOracle = createOracleSummary({
  expiryMs: 1_781_640_000_000n,
  lifecycleStatus: 'SETTLED',
  oracleId: ethOracleId,
  settlementPrice1e9: 3_300_000_000_000n,
  settledAtMs: 1_781_640_010_000n,
  underlyingAsset: 'ETH',
});

beforeEach(() => {
  vi.clearAllMocks();
  installDefaultHookMocks();
});

describe('MarketIntelligencePage', () => {
  it('renders active oracle context, freshness, ask-bounds TODO VERIFY state, and detail actions', () => {
    render(<MarketIntelligencePage nowMs={nowMs} />);

    expect(screen.getByRole('heading', { name: 'Market Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('DUSDC supported')).toBeInTheDocument();
    expect(screen.getByText('TODO VERIFY missing')).toBeInTheDocument();

    const selectedMarket = screen.getByLabelText('Selected market');
    expect(within(selectedMarket).getByRole('heading', { name: /BTC/i })).toBeInTheDocument();
    expect(within(selectedMarket).getByText('Fresh')).toBeInTheDocument();
    expect(
      within(selectedMarket).getByText('TODO VERIFY numeric bounds unmapped'),
    ).toBeInTheDocument();
    expect(within(selectedMarket).getByText(ORACLE_LIVE_TAPE_SOURCE)).toBeInTheDocument();

    const detailLink = within(selectedMarket).getByRole('link', { name: 'Strategy' });
    expect(detailLink).toHaveAttribute('href', `/markets/${btcOracleId}`);
    expect(within(selectedMarket).getByRole('link', { name: 'SVI' })).toHaveAttribute(
      'href',
      `/svi?oracleId=${btcOracleId}`,
    );
    expect(within(selectedMarket).getByRole('link', { name: 'Oracle Status' })).toHaveAttribute(
      'href',
      `/oracle-status?oracleId=${btcOracleId}`,
    );

    fireEvent.click(within(selectedMarket).getByRole('button', { name: 'Copy Oracle ID' }));
    expect(
      within(selectedMarket).getByRole('button', { name: 'Oracle copied' }),
    ).toBeInTheDocument();
  });

  it('filters by loaded underlying and lifecycle values without requesting new data shapes', () => {
    render(<MarketIntelligencePage nowMs={nowMs} />);

    fireEvent.change(screen.getByLabelText('Underlying'), { target: { value: 'ETH' } });

    const oracleList = screen.getByLabelText('Oracle list');
    expect(within(oracleList).getByText('ETH Oracle')).toBeInTheDocument();
    expect(within(oracleList).queryByText('BTC Oracle')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected market')).toHaveTextContent('ETH');

    fireEvent.change(screen.getByLabelText('Lifecycle'), { target: { value: 'ACTIVE' } });

    expect(screen.getByText('No markets match these filters')).toBeInTheDocument();
  });

  it('shows an honest loading state while market hooks are pending', () => {
    vi.mocked(usePredictState).mockReturnValue(queryPending<PredictStateModel>());
    vi.mocked(usePredictOracles).mockReturnValue(queryPending<OracleSummaryModel[]>());

    render(<MarketIntelligencePage nowMs={nowMs} />);

    expect(
      screen.getByRole('status', { name: 'Market intelligence loading state' }),
    ).toHaveTextContent('Loading market intelligence');
  });

  it('shows an empty state when the existing oracle list hook returns no markets', () => {
    vi.mocked(usePredictOracles).mockReturnValue(querySuccess<OracleSummaryModel[]>([]));

    render(<MarketIntelligencePage nowMs={nowMs} />);

    expect(screen.getByLabelText('Market intelligence empty state')).toHaveTextContent(
      'No Predict oracles loaded',
    );
  });

  it('shows a safe error state when required market data fails', () => {
    vi.mocked(usePredictState).mockReturnValue(
      queryError<PredictStateModel>(new Error('Predict server unavailable')),
    );

    render(<MarketIntelligencePage nowMs={nowMs} />);

    expect(
      screen.getByRole('alert', { name: 'Market intelligence error state' }),
    ).toHaveTextContent('Predict server unavailable');
  });

  it('labels unknown freshness and missing oracle payloads without inventing values', () => {
    vi.mocked(useOracleState).mockReturnValue(
      querySuccess<OracleStateModel>(
        createOracleState({
          latestPrice: null,
          latestSvi: null,
          oracle: btcOracle,
        }),
      ),
    );
    vi.mocked(useAskBounds).mockReturnValue(
      querySuccess<OracleAskBoundsModel>({ status: 'UNAVAILABLE' }),
    );
    vi.mocked(useLiveOracleTape).mockReturnValue(liveTapeResult(undefined));

    render(<MarketIntelligencePage nowMs={nowMs} />);

    const selectedMarket = screen.getByLabelText('Selected market');
    expect(within(selectedMarket).getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(within(selectedMarket).getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(within(selectedMarket).getAllByText('TODO VERIFY latest price missing')).toHaveLength(2);
    expect(within(selectedMarket).getByText('TODO VERIFY live oracle tape')).toBeInTheDocument();
  });
});

function installDefaultHookMocks() {
  vi.mocked(usePredictState).mockReturnValue(querySuccess(predictState));
  vi.mocked(usePredictOracles).mockReturnValue(querySuccess([btcOracle, ethOracle]));
  vi.mocked(useOracleState).mockImplementation(({ oracleId }) =>
    querySuccess(
      oracleId === ethOracleId
        ? createOracleState({
            latestPrice: createPrice({ oracleId: ethOracleId, spot1e9: 3_350_000_000_000n }),
            oracle: ethOracle,
          })
        : createOracleState({ oracle: btcOracle }),
    ),
  );
  vi.mocked(useAskBounds).mockImplementation(({ oracleId }) =>
    querySuccess(
      oracleId === ethOracleId ? { status: 'UNAVAILABLE' } : { status: 'PRESENT_UNMAPPED' },
    ),
  );
  vi.mocked(useLiveOracleTape).mockReturnValue(liveTapeResult(createLiveTape()));
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

function queryPending<T>(): UseQueryResult<T, PredictPilotError> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isFetching: true,
    isLoading: true,
    isPending: true,
    isSuccess: false,
  } as unknown as UseQueryResult<T, PredictPilotError>;
}

function queryError<T>(error: Error): UseQueryResult<T, PredictPilotError> {
  return {
    data: undefined,
    error: error as unknown as PredictPilotError,
    isError: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
  } as unknown as UseQueryResult<T, PredictPilotError>;
}

function liveTapeResult(data: LiveOracleTapeModel | undefined) {
  return {
    data,
    error: null,
    eventMetadata: {
      eventTypeSuffixes: [],
      eventTypes: [],
      packageId,
    },
    isEnabled: true,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: data !== undefined,
    pollIntervalMs: 3_000,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useLiveOracleTape>;
}

function createOracleSummary({
  expiryMs = 1_781_641_800_000n,
  lifecycleStatus,
  oracleId,
  settlementPrice1e9 = null,
  settledAtMs = null,
  underlyingAsset,
}: {
  expiryMs?: bigint;
  lifecycleStatus: OracleSummaryModel['lifecycleStatus'];
  oracleId: ObjectId;
  settlementPrice1e9?: bigint | null;
  settledAtMs?: bigint | null;
  underlyingAsset: string;
}): OracleSummaryModel {
  return {
    activatedAtMs: 1_781_634_686_445n,
    createdCheckpoint: 349_219_640n,
    expiryMs,
    lifecycleStatus,
    minStrike1e9: underlyingAsset === 'BTC' ? 50_000_000_000_000n : 2_000_000_000_000n,
    oracleCapId: `0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817`,
    oracleId,
    predictId,
    settlementPrice1e9,
    settledAtMs,
    tickSize1e9: 1_000_000_000n,
    underlyingAsset,
  };
}

function createOracleState({
  latestPrice = createPrice({ oracleId: btcOracleId }),
  latestSvi = createSvi({ oracleId: btcOracleId }),
  oracle,
}: {
  latestPrice?: OracleIndexedPriceModel | null;
  latestSvi?: OracleIndexedSviModel | null;
  oracle: OracleSummaryModel;
}): OracleStateModel {
  return {
    askBounds: { status: 'PRESENT_UNMAPPED' },
    latestPrice,
    latestSvi,
    oracle,
  };
}

function createPrice({
  oracleId,
  spot1e9 = 65_250_000_000_000n,
}: {
  oracleId: ObjectId;
  spot1e9?: bigint;
}): OracleIndexedPriceModel {
  return {
    checkpoint: 349_222_343n,
    checkpointTimestampMs: BigInt(nowMs - 1_000),
    digest: `price-digest-${oracleId}`,
    eventDigest: `price-event-${oracleId}`,
    eventIndex: 0,
    forward1e9: spot1e9 + 250_000_000_000n,
    onchainTimestampMs: BigInt(nowMs - 1_000),
    oracleId,
    packageId,
    sender,
    spot1e9,
    txIndex: 0,
  };
}

function createSvi({ oracleId }: { oracleId: ObjectId }): OracleIndexedSviModel {
  return {
    checkpoint: 349_222_344n,
    checkpointTimestampMs: BigInt(nowMs - 5_000),
    digest: `svi-digest-${oracleId}`,
    eventDigest: `svi-event-${oracleId}`,
    eventIndex: 1,
    onchainTimestampMs: BigInt(nowMs - 5_000),
    oracleId,
    packageId,
    sender,
    svi: {
      a1e9: 100n,
      b1e9: 200n,
      m1e9Signed: -400n,
      rho1e9Signed: -300n,
      sigma1e9: 500n,
    },
    txIndex: 1,
  };
}

function createLiveTape(): LiveOracleTapeModel {
  const oracleState = createOracleState({ oracle: btcOracle });

  return {
    eventMetadata: {
      eventTypeSuffixes: [],
      eventTypes: [],
      packageId,
    },
    freshness: {
      aggregateSeverity: 'success',
      aggregateStatus: 'FRESH',
      price: {
        ageMs: 1_000n,
        freshForMs: 5_000n,
        isFresh: true,
        isStale: false,
        isUnknown: false,
        lastUpdatedAtMs: BigInt(nowMs - 1_000),
        nowMs: BigInt(nowMs),
        severity: 'success',
        staleAfterMs: 15_000n,
        status: 'FRESH',
      },
      svi: {
        ageMs: 5_000n,
        freshForMs: 20_000n,
        isFresh: true,
        isStale: false,
        isUnknown: false,
        lastUpdatedAtMs: BigInt(nowMs - 5_000),
        nowMs: BigInt(nowMs),
        severity: 'success',
        staleAfterMs: 45_000n,
        status: 'FRESH',
      },
    },
    lastObservedLifecycleStatus: 'ACTIVE',
    lastObservedPriceTimestampMs: BigInt(nowMs - 1_000),
    lastObservedSviTimestampMs: BigInt(nowMs - 5_000),
    lastPollAtMs: BigInt(nowMs),
    latestOracleState: oracleState,
    lifecycleStatus: 'ACTIVE',
    oracleId: btcOracleId,
    pollIntervalMs: 3_000,
    source: ORACLE_LIVE_TAPE_SOURCE,
    updateCount: 2,
  };
}
