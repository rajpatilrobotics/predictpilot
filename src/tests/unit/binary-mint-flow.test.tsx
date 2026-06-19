import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  useBinaryMintFlow,
  type BeginBinaryMintReviewInput,
} from '@/features/trade/actions/useBinaryMintFlow';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { MarketKeyModel, QuoteAmount } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
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

describe('useBinaryMintFlow', () => {
  it('blocks disconnected wallets before building a PTB', async () => {
    const { result } = renderBinaryMintFlow({
      walletStatus: createTradeWalletStatus({
        accountAddress: null,
        isConnected: false,
        isDisconnected: true,
        shortAddress: null,
        status: 'disconnected',
      }),
    });

    const outcome = await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('WALLET_NOT_CONNECTED');
    }
    expect(result.current.state.phase).toBe('failure');
    expect(dAppKitMocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it('blocks wrong-network wallets before simulation', async () => {
    const { result } = renderBinaryMintFlow({
      walletStatus: createTradeWalletStatus({
        currentNetwork: 'mainnet',
        isExpectedNetwork: false,
        isWrongNetwork: true,
      }),
    });

    const outcome = await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('WRONG_NETWORK');
    }
    expect(result.current.state.phase).toBe('failure');
  });

  it('blocks missing manager and missing manager summary states', async () => {
    const noManager = renderBinaryMintFlow({
      manager: createTradeManagerState({
        authoritativeObject: null,
        isReady: false,
        manager: null,
        managerId: null,
        owner: null,
        status: 'NO_MANAGER',
      }),
    });
    const noManagerOutcome = await beginReview(noManager.result, {
      marketKey: createMarketKey(),
      quantityQuote,
    });

    const noSummary = renderBinaryMintFlow({ managerSummary: null });
    const noSummaryOutcome = await beginReview(noSummary.result, {
      marketKey: createMarketKey(),
      quantityQuote,
    });

    expect(noManagerOutcome.ok).toBe(false);
    expect(noSummaryOutcome.ok).toBe(false);
    if (!noManagerOutcome.ok && !noSummaryOutcome.ok) {
      expect(noManagerOutcome.error.code).toBe('MANAGER_NOT_FOUND');
      expect(noSummaryOutcome.error.code).toBe('MANAGER_NOT_FOUND');
    }
  });

  it('blocks invalid quantity and invalid market key inputs', async () => {
    const invalidQuantity = renderBinaryMintFlow();
    const invalidQuantityOutcome = await beginReview(invalidQuantity.result, {
      marketKey: createMarketKey(),
      quantityQuote: 0n,
    });

    const invalidKey = renderBinaryMintFlow();
    const invalidKeyOutcome = await beginReview(invalidKey.result, {
      marketKey: null,
      quantityQuote,
    });

    expect(invalidQuantityOutcome.ok).toBe(false);
    expect(invalidKeyOutcome.ok).toBe(false);
    if (!invalidQuantityOutcome.ok && !invalidKeyOutcome.ok) {
      expect(invalidQuantityOutcome.error.code).toBe('INVALID_INPUT');
      expect(invalidKeyOutcome.error.code).toBe('INVALID_INPUT');
    }
  });

  it('blocks stale oracles before signature is possible', async () => {
    const { result } = renderBinaryMintFlow({
      oracleState: createTradeOracleState({
        priceTimestampMs: tradeTestNowMs - 90_000,
        sviTimestampMs: tradeTestNowMs - 90_000,
      }),
    });

    const outcome = await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('ORACLE_STALE');
    }
    expect(result.current.canRequestSignature).toBe(false);
  });

  it('builds and simulates a valid binary mint before enabling signature', async () => {
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderBinaryMintFlow({ simulationTransport });

    const outcome = await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

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
      action: 'MINT',
      managerId: tradeTestManagerId,
      oracleId: tradeTestOracleId,
    });
  });

  it('maps wallet rejection to TRANSACTION_REJECTED', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderBinaryMintFlow({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
  });

  it('stores digest and invalidates affected Predict queries after success', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport();
    const { result } = renderBinaryMintFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

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
    const { result } = renderBinaryMintFlow({
      executionTransport: createTradeExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });

  it('recovers a submitted binary mint digest when wallet handoff does not return', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const signAndExecuteTransaction = vi.fn(() => new Promise<never>(() => undefined));
    const waitForTransaction = vi.fn();
    const historyClient = createHistoryClient({
      fetchPositionMintHistoryDto: vi.fn().mockImplementation(() =>
        Promise.resolve([
          binaryMintDto({
            checkpoint_timestamp_ms: Date.now() + 1_000,
            digest: 'recovered-binary-mint-digest',
          }),
        ]),
      ),
    });
    const { result } = renderBinaryMintFlow({
      executionTransport: createTradeExecutionTransport({
        signAndExecuteTransaction,
        waitForTransaction,
      }),
      historyClient,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      tradeRecoveryMaxAttempts: 1,
      tradeRecoveryPollDelayMs: 0,
      walletReturnTimeoutMs: 1,
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-binary-mint-digest');
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-binary-mint-digest',
      status: 'success',
    });
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.executionNotice).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });

  it('recovers a binary mint digest when the indexed checkpoint is slightly before the local request clock', async () => {
    const checkpointTimestampMs = Date.now() - 60_000;
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const signAndExecuteTransaction = vi.fn(() => new Promise<never>(() => undefined));
    const historyClient = createHistoryClient({
      fetchPositionMintHistoryDto: vi.fn().mockResolvedValue([
        binaryMintDto({
          checkpoint_timestamp_ms: checkpointTimestampMs,
          digest: 'recovered-early-checkpoint-digest',
        }),
      ]),
    });
    const { result } = renderBinaryMintFlow({
      executionTransport: createTradeExecutionTransport({
        signAndExecuteTransaction,
      }),
      historyClient,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      tradeRecoveryMaxAttempts: 1,
      tradeRecoveryPollDelayMs: 0,
      walletReturnTimeoutMs: 1,
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-early-checkpoint-digest');
    expect(result.current.state.error).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
  });
});

function renderBinaryMintFlow({
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
  queryClient?: Parameters<typeof useBinaryMintFlow>[0]['queryClient'];
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
      useBinaryMintFlow({
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
  result: ReturnType<typeof renderBinaryMintFlow>['result'],
  input: BeginBinaryMintReviewInput,
) {
  let outcome: Awaited<ReturnType<ReturnType<typeof useBinaryMintFlow>['beginMintReview']>>;

  await act(async () => {
    outcome = await result.current.beginMintReview(input);
  });

  return outcome!;
}

function createMarketKey(): MarketKeyModel {
  const oracleState = createTradeOracleState();

  return {
    direction: 'UP',
    expiryMs: oracleState.oracle.expiryMs,
    oracleId: tradeTestOracleId,
    strike1e9: oracleState.oracle.minStrike1e9,
  };
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

function binaryMintDto({
  checkpoint_timestamp_ms = tradeTestNowMs,
  digest = 'binary-mint-digest',
}: {
  checkpoint_timestamp_ms?: number;
  digest?: string;
}) {
  const marketKey = createMarketKey();

  return {
    event_digest: `${digest}-event`,
    digest,
    sender: tradeTestOwner,
    checkpoint: 1,
    checkpoint_timestamp_ms,
    tx_index: 0,
    event_index: 0,
    package: predictDeploymentConfig.packageId,
    ask_price: 375_992_790,
    cost: 375_992,
    expiry: String(marketKey.expiryMs),
    is_up: marketKey.direction === 'UP',
    manager_id: tradeTestManagerId,
    oracle_id: marketKey.oracleId,
    predict_id: predictDeploymentConfig.predictObjectId,
    quantity: String(quantityQuote),
    quote_asset: predictDeploymentConfig.quoteAsset.type,
    strike: String(marketKey.strike1e9),
    trader: tradeTestOwner,
  };
}
