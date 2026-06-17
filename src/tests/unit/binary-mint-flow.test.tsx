import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useBinaryMintFlow,
  type BeginBinaryMintReviewInput,
} from '@/features/trade/actions/useBinaryMintFlow';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { MarketKeyModel, QuoteAmount } from '@/types/predict';
import {
  createTradeManagerState,
  createTradeManagerSummary,
  createTradeOracleState,
  createTradeWalletStatus,
  presentAskBounds,
  tradeTestManagerId,
  tradeTestNowMs,
  tradeTestOracleId,
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
    const simulationTransport = createReadySimulationTransport();
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
    const executionTransport = createExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderBinaryMintFlow({
      executionTransport,
      simulationTransport: createReadySimulationTransport(),
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
    const executionTransport = createExecutionTransport();
    const { result } = renderBinaryMintFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport: createReadySimulationTransport(),
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
      executionTransport: createExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadySimulationTransport(),
    });
    await beginReview(result, { marketKey: createMarketKey(), quantityQuote });

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });
});

function renderBinaryMintFlow({
  executionTransport,
  manager = createTradeManagerState(),
  managerSummary = createTradeManagerSummary(),
  oracleState = createTradeOracleState(),
  queryClient,
  simulationTransport = createReadySimulationTransport(),
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  manager?: ReturnType<typeof createTradeManagerState>;
  managerSummary?: ReturnType<typeof createTradeManagerSummary> | null;
  oracleState?: ReturnType<typeof createTradeOracleState>;
  queryClient?: Parameters<typeof useBinaryMintFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
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
        manager,
        managerSummary,
        nowMs: tradeTestNowMs,
        oracleState,
        queryClient,
        simulationTransport,
        walletStatus,
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

function createReadySimulationTransport(): PredictSimulationTransport {
  return {
    simulateTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        balanceChanges: [{ amount: '-1000' }],
        digest: 'sim-digest',
        effects: { status: { status: 'success' } },
        events: [{ type: 'binary-mint' }],
        objectTypes: {
          [tradeTestManagerId]: 'predict_manager::PredictManager',
        },
      },
      commandResults: [
        { returnValues: [{ bcs: new Uint8Array([1]) }], mutatedReferences: [] },
        { returnValues: [], mutatedReferences: [{ bcs: new Uint8Array([2]) }] },
      ],
    }),
  };
}

function createExecutionTransport({
  signAndExecuteTransaction = vi.fn().mockResolvedValue({
    $kind: 'Transaction',
    Transaction: {
      digest: 'tx-digest',
      effects: { status: { status: 'success' } },
    },
  }),
  waitForTransaction = vi.fn().mockResolvedValue({
    $kind: 'Transaction',
    Transaction: {
      digest: 'tx-digest',
      effects: { status: { status: 'success' } },
    },
  }),
}: Partial<PredictTransactionTransport> = {}): PredictTransactionTransport {
  return {
    signAndExecuteTransaction,
    waitForTransaction,
  };
}
