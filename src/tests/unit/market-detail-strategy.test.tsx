import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import {
  useBinaryMintFlow,
  type BeginBinaryMintReviewInput,
  type BeginBinaryMintReviewResult,
  type BinaryMintFlowState,
} from '@/features/trade/actions/useBinaryMintFlow';
import {
  useBinaryRedeemFlow,
  type BeginBinaryRedeemReviewInput,
  type BeginBinaryRedeemReviewResult,
  type BinaryRedeemFlowState,
} from '@/features/trade/actions/useBinaryRedeemFlow';
import {
  useRangeMintFlow,
  type BeginRangeMintReviewInput,
  type BeginRangeMintReviewResult,
  type RangeMintFlowState,
} from '@/features/trade/actions/useRangeMintFlow';
import {
  useRangeRedeemFlow,
  type BeginRangeRedeemReviewInput,
  type BeginRangeRedeemReviewResult,
  type RangeRedeemFlowState,
} from '@/features/trade/actions/useRangeRedeemFlow';
import { MarketDetailPage } from '@/features/trade/MarketDetailPage';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import {
  createTradeBinaryPosition,
  createTradeManagerState,
  createTradeManagerSummaryPortfolio,
  createTradeOracleState,
  createTradePositionsSummary,
  createTradeRangePosition,
  createTradeWalletStatus,
  presentAskBounds,
  querySuccess,
  tradeTestManagerId,
  tradeTestNowMs,
  tradeTestOracleId,
  tradeTestOwner,
} from './trade-test-helpers';

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

vi.mock('@/features/trade/actions/useBinaryMintFlow', () => ({
  useBinaryMintFlow: vi.fn(),
}));

vi.mock('@/features/trade/actions/useBinaryRedeemFlow', () => ({
  useBinaryRedeemFlow: vi.fn(),
}));

vi.mock('@/features/trade/actions/useRangeMintFlow', () => ({
  useRangeMintFlow: vi.fn(),
}));

vi.mock('@/features/trade/actions/useRangeRedeemFlow', () => ({
  useRangeRedeemFlow: vi.fn(),
}));

interface HookState {
  askBounds: UseQueryResult<OracleAskBoundsModel, PredictPilotError>;
  manager: ReturnType<typeof createTradeManagerState>;
  managerSummary: UseQueryResult<
    ReturnType<typeof createTradeManagerSummaryPortfolio>,
    PredictPilotError
  >;
  oracleState: UseQueryResult<OracleStateModel, PredictPilotError>;
  positionsSummary: UseQueryResult<
    ReturnType<typeof createTradePositionsSummary>,
    PredictPilotError
  >;
  wallet: ReturnType<typeof createTradeWalletStatus>;
}

const hookState: HookState = {
  askBounds: querySuccess<OracleAskBoundsModel>(presentAskBounds()),
  manager: createTradeManagerState(),
  managerSummary: querySuccess(createTradeManagerSummaryPortfolio()),
  oracleState: querySuccess(createTradeOracleState()),
  positionsSummary: querySuccess(createTradePositionsSummary()),
  wallet: createTradeWalletStatus(),
};

const beginMintReview =
  vi.fn<(input: BeginBinaryMintReviewInput) => Promise<BeginBinaryMintReviewResult>>();
const beginRedeemReview =
  vi.fn<(input: BeginBinaryRedeemReviewInput) => Promise<BeginBinaryRedeemReviewResult>>();
const beginMintRangeReview =
  vi.fn<(input: BeginRangeMintReviewInput) => Promise<BeginRangeMintReviewResult>>();
const beginRedeemRangeReview =
  vi.fn<(input: BeginRangeRedeemReviewInput) => Promise<BeginRangeRedeemReviewResult>>();
const closeBinaryMintModal = vi.fn();
const closeBinaryRedeemModal = vi.fn();
const closeRangeMintModal = vi.fn();
const closeRangeRedeemModal = vi.fn();
const requestBinaryMintSignature = vi.fn();
const requestBinaryRedeemSignature = vi.fn();
const requestRangeMintSignature = vi.fn();
const requestRangeRedeemSignature = vi.fn();
const rerunBinaryMintSimulation = vi.fn();
const rerunBinaryRedeemSimulation = vi.fn();
const rerunRangeMintSimulation = vi.fn();
const rerunRangeRedeemSimulation = vi.fn();
const resetBinaryMintFlow = vi.fn();
const resetBinaryRedeemFlow = vi.fn();
const resetRangeMintFlow = vi.fn();
const resetRangeRedeemFlow = vi.fn();

beforeEach(() => {
  beginMintReview.mockResolvedValue({ ok: true });
  beginRedeemReview.mockResolvedValue({ ok: true });
  beginMintRangeReview.mockResolvedValue({ ok: true });
  beginRedeemRangeReview.mockResolvedValue({ ok: true });
  closeBinaryMintModal.mockReset();
  closeBinaryRedeemModal.mockReset();
  closeRangeMintModal.mockReset();
  closeRangeRedeemModal.mockReset();
  requestBinaryMintSignature.mockReset();
  requestBinaryRedeemSignature.mockReset();
  requestRangeMintSignature.mockReset();
  requestRangeRedeemSignature.mockReset();
  rerunBinaryMintSimulation.mockReset();
  rerunBinaryRedeemSimulation.mockReset();
  rerunRangeMintSimulation.mockReset();
  rerunRangeRedeemSimulation.mockReset();
  resetBinaryMintFlow.mockReset();
  resetBinaryRedeemFlow.mockReset();
  resetRangeMintFlow.mockReset();
  resetRangeRedeemFlow.mockReset();

  hookState.askBounds = querySuccess<OracleAskBoundsModel>(presentAskBounds());
  hookState.manager = createTradeManagerState();
  hookState.managerSummary = querySuccess(createTradeManagerSummaryPortfolio());
  hookState.oracleState = querySuccess(createTradeOracleState());
  hookState.positionsSummary = querySuccess(createTradePositionsSummary());
  hookState.wallet = createTradeWalletStatus();

  vi.mocked(useWalletStatus).mockImplementation(() => hookState.wallet);
  vi.mocked(usePredictManager).mockImplementation(() => hookState.manager);
  vi.mocked(useOracleState).mockImplementation(() => hookState.oracleState);
  vi.mocked(useAskBounds).mockImplementation(() => hookState.askBounds);
  vi.mocked(useManagerSummary).mockImplementation(() => hookState.managerSummary);
  vi.mocked(usePositionsSummary).mockImplementation(() => hookState.positionsSummary);
  vi.mocked(useBinaryMintFlow).mockImplementation(() => createBinaryMintFlowMock());
  vi.mocked(useBinaryRedeemFlow).mockImplementation(() => createBinaryRedeemFlowMock());
  vi.mocked(useRangeMintFlow).mockImplementation(() => createRangeMintFlowMock());
  vi.mocked(useRangeRedeemFlow).mockImplementation(() => createRangeRedeemFlowMock());
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

  it('renders focused market detail and opens the binary mint review through the action hook', async () => {
    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    expect(screen.getByRole('heading', { name: 'Market Detail / Strategy' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Strategy builder' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    await waitFor(() => expect(beginMintReview).toHaveBeenCalledTimes(1));
    const reviewInput = beginMintReview.mock.calls[0]?.[0];
    expect(reviewInput?.marketKey).toMatchObject({
      direction: 'UP',
      oracleId: tradeTestOracleId,
    });
    expect(reviewInput?.quantityQuote).toBe(1_000_000n);
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('opens the binary redeem review with a matching owned position fixture', async () => {
    const ownedPosition = createTradeBinaryPosition();
    hookState.positionsSummary = querySuccess(
      createTradePositionsSummary({
        binaryPositions: [ownedPosition],
      }),
    );

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.change(screen.getByLabelText('Binary action'), {
      target: { value: 'REDEEM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    await waitFor(() => expect(beginRedeemReview).toHaveBeenCalledTimes(1));
    const reviewInput = beginRedeemReview.mock.calls[0]?.[0];
    expect(reviewInput?.marketKey).toMatchObject({
      direction: 'UP',
      oracleId: tradeTestOracleId,
    });
    expect(reviewInput?.ownedPosition).toMatchObject({
      openQuantityQuote: ownedPosition.openQuantityQuote,
    });
    expect(reviewInput?.quantityQuote).toBe(1_000_000n);
    expect(beginMintReview).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('opens the range mint review with a locally valid range key', async () => {
    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Range' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    await waitFor(() => expect(beginMintRangeReview).toHaveBeenCalledTimes(1));
    const reviewInput = beginMintRangeReview.mock.calls[0]?.[0];
    expect(reviewInput?.rangeKey).toMatchObject({
      oracleId: tradeTestOracleId,
    });
    expect(reviewInput?.quantityQuote).toBe(1_000_000n);
    expect(beginMintReview).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('opens the range redeem review with a matching owned range fixture', async () => {
    const ownedRangePosition = createTradeRangePosition();
    hookState.positionsSummary = querySuccess(
      createTradePositionsSummary({
        rangePositions: [ownedRangePosition],
      }),
    );

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Range' }));
    fireEvent.change(screen.getByLabelText('Range action'), {
      target: { value: 'REDEEM_RANGE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    await waitFor(() => expect(beginRedeemRangeReview).toHaveBeenCalledTimes(1));
    const reviewInput = beginRedeemRangeReview.mock.calls[0]?.[0];
    expect(reviewInput?.rangeKey).toMatchObject({
      oracleId: tradeTestOracleId,
    });
    expect(reviewInput?.ownedRangePosition).toMatchObject({
      quantityQuote: ownedRangePosition.quantityQuote,
    });
    expect(reviewInput?.quantityQuote).toBe(1_000_000n);
    expect(beginRedeemReview).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('validates binary quantity before any signing flow exists', async () => {
    beginMintReview.mockResolvedValueOnce({
      error: createAppError('INVALID_INPUT', {
        message: 'Binary mint quantity must be greater than zero.',
      }),
      ok: false,
      warnings: [],
    });

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.change(screen.getByLabelText('Quantity (DUSDC atomic)'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('Binary mint quantity must be greater than zero.');
  });

  it('validates range strike order distinctly from binary mode', async () => {
    beginMintRangeReview.mockResolvedValueOnce({
      error: createAppError('INVALID_INPUT', {
        message: 'A valid range key is required before mint range execution.',
      }),
      ok: false,
      warnings: [],
    });

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Range' }));
    fireEvent.change(screen.getByLabelText('Higher strike'), {
      target: { value: '50000000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('A valid range key is required before mint range execution.');
  });

  it('surfaces wallet and manager blockers without signing controls', () => {
    hookState.wallet = createTradeWalletStatus({
      accountAddress: null,
      isConnected: false,
      isDisconnected: true,
      shortAddress: null,
      status: 'disconnected',
      statusLabel: 'Disconnected',
    });
    hookState.manager = createTradeManagerState({
      authoritativeObject: null,
      isReady: false,
      manager: null,
      managerId: null,
      owner: null,
      status: 'NO_WALLET',
    });

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    expect(
      screen.getByText(/Connect wallet before opening a guarded simulation review/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/PredictManager is not ready/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request wallet signature' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces wrong-network state before future execution wiring', () => {
    hookState.wallet = createTradeWalletStatus({
      currentNetwork: 'mainnet',
      isExpectedNetwork: false,
      isWrongNetwork: true,
    });

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    expect(screen.getByText(/Wrong network/i)).toBeInTheDocument();
    expect(screen.getByText(/Switch from mainnet to testnet/i)).toBeInTheDocument();
  });

  it('blocks stale oracle previews with protocol-safe copy', async () => {
    beginMintReview.mockResolvedValueOnce({
      error: createAppError('ORACLE_STALE', {
        message: 'The selected oracle data is stale.',
      }),
      ok: false,
      warnings: [],
    });
    hookState.oracleState = querySuccess(
      createTradeOracleState({
        priceTimestampMs: tradeTestNowMs - 90_000,
        sviTimestampMs: tradeTestNowMs - 90_000,
      }),
    );

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview strategy' }));

    expect(
      await screen.findByRole('alert', { name: 'Strategy preview blocked' }),
    ).toHaveTextContent('The selected oracle data is stale.');
  });

  it('enables wallet signature only when binary mint simulation is ready', () => {
    vi.mocked(useBinaryMintFlow).mockImplementation(() =>
      createBinaryMintFlowMock({
        canRequestSignature: true,
        state: {
          completedDigest: null,
          modalOpen: true,
          phase: 'ready',
          simulationPreview: createReadySimulationPreview(),
        },
      }),
    );

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    expect(
      screen.getByRole('dialog', { name: 'Binary mint execution review' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request wallet signature' })).toBeEnabled();
  });

  it('enables wallet signature only when range mint simulation is ready', () => {
    vi.mocked(useRangeMintFlow).mockImplementation(() =>
      createRangeMintFlowMock({
        canRequestSignature: true,
        state: {
          completedDigest: null,
          modalOpen: true,
          phase: 'ready',
          simulationPreview: createReadySimulationPreview('MINT_RANGE'),
        },
      }),
    );

    render(<MarketDetailPage nowMs={tradeTestNowMs} oracleId={tradeTestOracleId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Range' }));

    expect(screen.getByRole('dialog', { name: 'Range mint execution review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request wallet signature' })).toBeEnabled();
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

function createBinaryMintFlowMock({
  canRequestSignature = false,
  state,
}: {
  canRequestSignature?: boolean;
  state?: Partial<BinaryMintFlowState>;
} = {}) {
  return {
    beginMintReview,
    canRequestSignature,
    closeModal: closeBinaryMintModal,
    requestSignature: requestBinaryMintSignature,
    rerunSimulation: rerunBinaryMintSimulation,
    reset: resetBinaryMintFlow,
    state: {
      builderPreview: null,
      completedDigest: null,
      error: null,
      executionNotice: null,
      executionRequest: null,
      executionResult: null,
      modalOpen: false,
      phase: 'idle',
      previewPreparedAtMs: null,
      refreshWarning: null,
      riskPreview: null,
      simulationPreview: null,
      warnings: [],
      ...state,
    } satisfies BinaryMintFlowState,
  };
}

function createBinaryRedeemFlowMock({
  canRequestSignature = false,
  state,
}: {
  canRequestSignature?: boolean;
  state?: Partial<BinaryRedeemFlowState>;
} = {}) {
  return {
    beginRedeemReview,
    canRequestSignature,
    closeModal: closeBinaryRedeemModal,
    requestSignature: requestBinaryRedeemSignature,
    rerunSimulation: rerunBinaryRedeemSimulation,
    reset: resetBinaryRedeemFlow,
    state: {
      builderPreview: null,
      completedDigest: null,
      error: null,
      executionNotice: null,
      executionRequest: null,
      executionResult: null,
      modalOpen: false,
      phase: 'idle',
      previewPreparedAtMs: null,
      refreshWarning: null,
      riskPreview: null,
      simulationPreview: null,
      warnings: [],
      ...state,
    } satisfies BinaryRedeemFlowState,
  };
}

function createRangeMintFlowMock({
  canRequestSignature = false,
  state,
}: {
  canRequestSignature?: boolean;
  state?: Partial<RangeMintFlowState>;
} = {}) {
  return {
    beginMintRangeReview,
    canRequestSignature,
    closeModal: closeRangeMintModal,
    requestSignature: requestRangeMintSignature,
    rerunSimulation: rerunRangeMintSimulation,
    reset: resetRangeMintFlow,
    state: {
      builderPreview: null,
      completedDigest: null,
      error: null,
      executionNotice: null,
      executionRequest: null,
      executionResult: null,
      modalOpen: false,
      phase: 'idle',
      previewPreparedAtMs: null,
      refreshWarning: null,
      riskPreview: null,
      simulationPreview: null,
      warnings: [],
      ...state,
    } satisfies RangeMintFlowState,
  };
}

function createRangeRedeemFlowMock({
  canRequestSignature = false,
  state,
}: {
  canRequestSignature?: boolean;
  state?: Partial<RangeRedeemFlowState>;
} = {}) {
  return {
    beginRedeemRangeReview,
    canRequestSignature,
    closeModal: closeRangeRedeemModal,
    requestSignature: requestRangeRedeemSignature,
    rerunSimulation: rerunRangeRedeemSimulation,
    reset: resetRangeRedeemFlow,
    state: {
      builderPreview: null,
      completedDigest: null,
      error: null,
      executionNotice: null,
      executionRequest: null,
      executionResult: null,
      modalOpen: false,
      phase: 'idle',
      previewPreparedAtMs: null,
      refreshWarning: null,
      riskPreview: null,
      simulationPreview: null,
      warnings: [],
      ...state,
    } satisfies RangeRedeemFlowState,
  };
}

function createReadySimulationPreview(
  action: PredictPtbSimulationPreview['intent']['action'] = 'MINT',
): PredictPtbSimulationPreview {
  return {
    intent: {
      action,
      affectedObjects: [
        { id: tradeTestManagerId, kind: 'manager', label: 'PredictManager' },
        { id: tradeTestOracleId, kind: 'oracle', label: 'OracleSVI' },
      ],
      assets: [],
      configIds: {
        network: 'testnet',
        packageId: predictDeploymentConfig.packageId,
        plpType: predictDeploymentConfig.plpType,
        predictObjectId: predictDeploymentConfig.predictObjectId,
        quoteAssetType: predictDeploymentConfig.quoteAsset.type,
      },
      managerId: tradeTestManagerId,
      oracleId: tradeTestOracleId,
      sender: tradeTestOwner,
      warnings: [],
    },
    simulation: {
      balanceChangeCount: 1,
      changedObjectTypeCount: 1,
      commandResultCount: 2,
      commandResults: [
        {
          commandIndex: 0,
          mutatedReferenceCount: 0,
          returnValueCount: 1,
        },
        {
          commandIndex: 1,
          mutatedReferenceCount: 1,
          returnValueCount: 0,
        },
      ],
      digest: 'sim-digest',
      effectsStatus: 'success',
      eventCount: 1,
      rawKind: 'Transaction',
      warnings: [],
    },
    status: 'ready',
  };
}
