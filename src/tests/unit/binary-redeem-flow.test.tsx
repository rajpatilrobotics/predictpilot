import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useBinaryRedeemFlow,
  type BeginBinaryRedeemReviewInput,
} from '@/features/trade/actions/useBinaryRedeemFlow';
import { predictDeploymentConfig } from '@/config/predict';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
  createTradeBinaryPosition,
  createTradeExecutionTransport,
  createTradeManagerState,
  createTradeManagerSummary,
  createTradeOracleState,
  createTradeWalletStatus,
  presentAskBounds,
  tradeTestManagerId,
  tradeTestNowMs,
  tradeTestOracleId,
  tradeTestOwner,
} from './trade-test-helpers';

const dAppKitMocks = vi.hoisted(() => ({
  signAndExecuteTransaction: vi.fn(),
  simulateTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentClient: () => ({
    simulateTransaction: dAppKitMocks.simulateTransaction,
    waitForTransaction: dAppKitMocks.waitForTransaction,
  }),
  useDAppKit: () => ({
    signAndExecuteTransaction: dAppKitMocks.signAndExecuteTransaction,
  }),
}));

const quantityQuote = 1_000_000n as QuoteAmount;

beforeEach(() => {
  dAppKitMocks.signAndExecuteTransaction.mockReset();
  dAppKitMocks.simulateTransaction.mockReset();
  dAppKitMocks.waitForTransaction.mockReset();
});

describe('useBinaryRedeemFlow', () => {
  it('blocks disconnected wallets, wrong networks, and missing manager state before building', async () => {
    const disconnected = renderBinaryRedeemFlow({
      walletStatus: createTradeWalletStatus({
        accountAddress: null,
        isConnected: false,
        isDisconnected: true,
        shortAddress: null,
        status: 'disconnected',
      }),
    });
    const wrongNetwork = renderBinaryRedeemFlow({
      walletStatus: createTradeWalletStatus({
        currentNetwork: 'mainnet',
        isExpectedNetwork: false,
        isWrongNetwork: true,
      }),
    });
    const noManager = renderBinaryRedeemFlow({
      manager: createTradeManagerState({
        authoritativeObject: null,
        isReady: false,
        manager: null,
        managerId: null,
        owner: null,
        status: 'NO_MANAGER',
      }),
    });
    const noSummary = renderBinaryRedeemFlow({ managerSummary: null });

    const outcomes = [
      await beginReview(disconnected.result),
      await beginReview(wrongNetwork.result),
      await beginReview(noManager.result),
      await beginReview(noSummary.result),
    ];

    expect(outcomes.map((outcome) => (outcome.ok ? null : outcome.error.code))).toEqual([
      'WALLET_NOT_CONNECTED',
      'WRONG_NETWORK',
      'MANAGER_NOT_FOUND',
      'MANAGER_NOT_FOUND',
    ]);
    expect(dAppKitMocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it('blocks invalid quantity and invalid market key inputs', async () => {
    const invalidQuantity = renderBinaryRedeemFlow();
    const invalidQuantityOutcome = await beginReview(invalidQuantity.result, {
      quantityQuote: 0n,
    });

    const invalidKey = renderBinaryRedeemFlow();
    const invalidKeyOutcome = await beginReview(invalidKey.result, {
      marketKey: null,
    });

    expect(invalidQuantityOutcome.ok).toBe(false);
    expect(invalidKeyOutcome.ok).toBe(false);
    if (!invalidQuantityOutcome.ok && !invalidKeyOutcome.ok) {
      expect(invalidQuantityOutcome.error.code).toBe('INVALID_INPUT');
      expect(invalidKeyOutcome.error.code).toBe('INVALID_INPUT');
    }
  });

  it('blocks missing owned positions and redeem quantities above the open quantity', async () => {
    const missingPosition = renderBinaryRedeemFlow();
    const missingPositionOutcome = await beginReview(missingPosition.result, {
      ownedPosition: null,
    });

    const smallPosition = createTradeBinaryPosition({
      openQuantityQuote: 500_000n,
    });
    const tooLarge = renderBinaryRedeemFlow();
    const tooLargeOutcome = await beginReview(tooLarge.result, {
      marketKey: smallPosition.key,
      ownedPosition: smallPosition,
      quantityQuote,
    });

    expect(missingPositionOutcome.ok).toBe(false);
    expect(tooLargeOutcome.ok).toBe(false);
    if (!missingPositionOutcome.ok && !tooLargeOutcome.ok) {
      expect(missingPositionOutcome.error.message).toMatch(/open binary position/i);
      expect(tooLargeOutcome.error.message).toMatch(/exceeds the open binary position/i);
    }
  });

  it('blocks stale and non-redeemable oracles before signature is possible', async () => {
    const stale = renderBinaryRedeemFlow({
      oracleState: createTradeOracleState({
        priceTimestampMs: tradeTestNowMs - 90_000,
        sviTimestampMs: tradeTestNowMs - 90_000,
      }),
    });
    const inactive = renderBinaryRedeemFlow({
      oracleState: createTradeOracleState({
        lifecycleStatus: 'INACTIVE',
      }),
    });

    const staleOutcome = await beginReview(stale.result);
    const inactiveOutcome = await beginReview(inactive.result);

    expect(staleOutcome.ok).toBe(false);
    expect(inactiveOutcome.ok).toBe(false);
    if (!staleOutcome.ok && !inactiveOutcome.ok) {
      expect(staleOutcome.error.code).toBe('ORACLE_STALE');
      expect(inactiveOutcome.error.code).toBe('ORACLE_NOT_TRADEABLE');
    }
  });

  it('builds and simulates a valid binary redeem before enabling signature', async () => {
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderBinaryRedeemFlow({ simulationTransport });

    const outcome = await beginReview(result);

    expect(outcome.ok).toBe(true);
    expect(simulationTransport.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({
      modalOpen: true,
      phase: 'ready',
      simulationPreview: {
        status: 'ready',
      },
    });
    expect(result.current.canRequestSignature).toBe(true);
    expect(result.current.state.riskPreview).toMatchObject({
      action: 'REDEEM',
      managerId: tradeTestManagerId,
      oracleId: tradeTestOracleId,
    });
  });

  it('maps wallet rejection to TRANSACTION_REJECTED', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderBinaryRedeemFlow({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
  });

  it('stores digest and invalidates affected Predict queries after success', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport();
    const { result } = renderBinaryRedeemFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(executionTransport.waitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        digest: 'tx-digest',
      }),
    );
  });

  it('keeps digest visible when post-submit query invalidation fails', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const { result } = renderBinaryRedeemFlow({
      executionTransport: createTradeExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });

  it('recovers a submitted binary redeem digest after delayed wallet handoff indexing', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const signAndExecuteTransaction = vi.fn(() => new Promise<never>(() => undefined));
    const waitForTransaction = vi.fn();
    const historyClient = createHistoryClient({
      fetchPositionRedeemHistoryDto: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          binaryRedeemDto({
            checkpoint_timestamp_ms: Date.now() + 1_000,
            digest: 'recovered-binary-redeem-digest',
          }),
        ]),
    });
    const { result } = renderBinaryRedeemFlow({
      executionTransport: createTradeExecutionTransport({
        signAndExecuteTransaction,
        waitForTransaction,
      }),
      historyClient,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      tradeRecoveryMaxAttempts: 2,
      tradeRecoveryPollDelayMs: 0,
      walletReturnTimeoutMs: 1,
    });
    await beginReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-binary-redeem-digest');
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-binary-redeem-digest',
      status: 'success',
    });
    expect(result.current.state.error).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });
});

function renderBinaryRedeemFlow({
  executionTransport,
  historyClient,
  manager = createTradeManagerState(),
  managerSummary = createTradeManagerSummary(),
  oracleState = createTradeOracleState(),
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  tradeRecoveryMaxAttempts,
  tradeRecoveryPollDelayMs,
  walletStatus = createTradeWalletStatus(),
  walletReturnTimeoutMs,
}: {
  executionTransport?: PredictTransactionTransport;
  historyClient?: HistoryReadClient;
  manager?: ReturnType<typeof createTradeManagerState>;
  managerSummary?: ReturnType<typeof createTradeManagerSummary> | null;
  oracleState?: ReturnType<typeof createTradeOracleState>;
  queryClient?: Parameters<typeof useBinaryRedeemFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  tradeRecoveryMaxAttempts?: number;
  tradeRecoveryPollDelayMs?: number;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
  walletReturnTimeoutMs?: number;
} = {}) {
  const providerClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={providerClient}>{children}</QueryClientProvider>
  );

  return renderHook(
    () =>
      useBinaryRedeemFlow({
        askBounds: presentAskBounds(),
        executionTransport,
        historyClient,
        manager,
        managerSummary,
        nowMs: tradeTestNowMs,
        oracleState,
        queryClient,
        simulationTransport,
        tradeRecoveryMaxAttempts,
        tradeRecoveryPollDelayMs,
        walletStatus,
        walletReturnTimeoutMs,
      }),
    { wrapper },
  );
}

async function beginReview(
  result: ReturnType<typeof renderBinaryRedeemFlow>['result'],
  input: Partial<BeginBinaryRedeemReviewInput> = {},
) {
  const fallbackPosition = createTradeBinaryPosition();
  const ownedPosition = Object.hasOwn(input, 'ownedPosition')
    ? input.ownedPosition
    : fallbackPosition;
  const marketKey =
    input.marketKey === undefined ? (ownedPosition?.key ?? fallbackPosition.key) : input.marketKey;
  const quantity = input.quantityQuote === undefined ? quantityQuote : input.quantityQuote;
  let outcome: Awaited<ReturnType<ReturnType<typeof useBinaryRedeemFlow>['beginRedeemReview']>>;

  await act(async () => {
    outcome = await result.current.beginRedeemReview({
      marketKey,
      ownedPosition,
      quantityQuote: quantity,
    });
  });

  return outcome!;
}

function createHistoryClient(overrides: Partial<HistoryReadClient>): HistoryReadClient {
  return {
    fetchLpSuppliesHistoryDto: vi.fn(),
    fetchLpWithdrawalsHistoryDto: vi.fn(),
    fetchOracleTradesDto: vi.fn(),
    fetchPositionMintHistoryDto: vi.fn(),
    fetchPositionRedeemHistoryDto: vi.fn(),
    fetchRangeMintHistoryDto: vi.fn(),
    fetchRangeRedeemHistoryDto: vi.fn(),
    ...overrides,
  };
}

function binaryRedeemDto({
  checkpoint_timestamp_ms = tradeTestNowMs,
  digest = 'binary-redeem-digest',
}: {
  checkpoint_timestamp_ms?: number;
  digest?: string;
}) {
  const position = createTradeBinaryPosition();

  return {
    bid_price: 26_738_000,
    checkpoint: 1,
    checkpoint_timestamp_ms,
    digest,
    event_digest: `${digest}-event`,
    event_index: 0,
    executor: tradeTestOwner,
    expiry: String(position.key.expiryMs),
    is_settled: false,
    is_up: position.key.direction === 'UP',
    manager_id: tradeTestManagerId,
    oracle_id: position.key.oracleId,
    owner: tradeTestOwner,
    package: predictDeploymentConfig.packageId,
    payout: 26_738,
    predict_id: predictDeploymentConfig.predictObjectId,
    quantity: String(quantityQuote),
    quote_asset: predictDeploymentConfig.quoteAsset.type,
    sender: tradeTestOwner,
    strike: String(position.key.strike1e9),
    tx_index: 0,
  };
}
