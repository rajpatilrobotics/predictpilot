import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateManagerFlow } from '@/features/manager/actions/useCreateManagerFlow';
import {
  useManagerDepositFlow,
  type BeginManagerDepositReviewInput,
} from '@/features/manager/actions/useManagerDepositFlow';
import {
  useManagerWithdrawFlow,
  type BeginManagerWithdrawReviewInput,
} from '@/features/manager/actions/useManagerWithdrawFlow';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
  createTradeExecutionTransport,
  createTradeManagerSummaryPortfolio,
  createTradeWalletStatus,
  tradeTestManagerId,
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

const depositAmount = 1_000_000n as QuoteAmount;
const withdrawAmount = 1_000_000n as QuoteAmount;
const defaultDepositReviewInput: BeginManagerDepositReviewInput = { amountQuote: depositAmount };
const defaultWithdrawReviewInput: BeginManagerWithdrawReviewInput = { amountQuote: withdrawAmount };

beforeEach(() => {
  dAppKitMocks.signAndExecuteTransaction.mockReset();
  dAppKitMocks.simulateTransaction.mockReset();
  dAppKitMocks.waitForTransaction.mockReset();
});

describe('manager execution flows', () => {
  it('blocks create-manager when wallet is disconnected, wrong-network, or a manager already exists', async () => {
    const disconnected = renderCreateManagerFlow({
      walletStatus: createTradeWalletStatus({
        accountAddress: null,
        isConnected: false,
        isDisconnected: true,
        shortAddress: null,
        status: 'disconnected',
      }),
    });
    const wrongNetwork = renderCreateManagerFlow({
      walletStatus: createTradeWalletStatus({
        currentNetwork: 'mainnet',
        isExpectedNetwork: false,
        isWrongNetwork: true,
      }),
    });
    const existing = renderCreateManagerFlow({ hasExistingManager: true });

    const outcomes = [
      await beginCreateManagerReview(disconnected.result),
      await beginCreateManagerReview(wrongNetwork.result),
      await beginCreateManagerReview(existing.result),
    ];

    expect(outcomes.map((outcome) => (outcome.ok ? null : outcome.error.code))).toEqual([
      'WALLET_NOT_CONNECTED',
      'WRONG_NETWORK',
      'INVALID_INPUT',
    ]);
    expect(dAppKitMocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it('builds, simulates, signs, and invalidates manager discovery after create-manager success', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport();
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderCreateManagerFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport,
    });

    const outcome = await beginCreateManagerReview(result);

    expect(outcome.ok).toBe(true);
    expect(result.current.canRequestSignature).toBe(true);
    expect(simulationTransport.simulateTransaction).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.requestSignature();
    });

    const invalidatedText = JSON.stringify(invalidateQueries.mock.calls);

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledOnce();
    expect(invalidatedText).toContain('manager');
  });

  it('blocks manager deposit for invalid amount, missing balance, and insufficient wallet DUSDC', async () => {
    const invalid = renderDepositFlow();
    const missingBalance = renderDepositFlow({ walletDusdcBalanceQuote: null });
    const insufficient = renderDepositFlow({ walletDusdcBalanceQuote: 1n });

    const invalidOutcome = await beginDepositReview(invalid.result, { amountQuote: 0n });
    const missingOutcome = await beginDepositReview(missingBalance.result);
    const insufficientOutcome = await beginDepositReview(insufficient.result);

    expect(invalidOutcome.ok).toBe(false);
    expect(missingOutcome.ok).toBe(false);
    expect(insufficientOutcome.ok).toBe(false);
    if (!invalidOutcome.ok && !missingOutcome.ok && !insufficientOutcome.ok) {
      expect(invalidOutcome.error.code).toBe('INVALID_INPUT');
      expect(missingOutcome.error.code).toBe('TODO_VERIFY_PATH_USED');
      expect(insufficientOutcome.error.code).toBe('INSUFFICIENT_WALLET_DUSDC');
    }
  });

  it('builds and simulates manager deposit before enabling signature', async () => {
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderDepositFlow({ simulationTransport });

    const outcome = await beginDepositReview(result);

    expect(outcome.ok).toBe(true);
    expect(result.current.state.phase).toBe('ready');
    expect(result.current.canRequestSignature).toBe(true);
    expect(result.current.state.riskPreview).toMatchObject({
      action: 'DEPOSIT_QUOTE',
      amountQuote: depositAmount,
      managerId: tradeTestManagerId,
    });
    expect(simulationTransport.simulateTransaction).toHaveBeenCalledOnce();
  });

  it('blocks manager withdraw for missing summary and insufficient manager balance', async () => {
    const missingSummary = renderWithdrawFlow({ managerSummary: null });
    const insufficient = renderWithdrawFlow({
      managerSummary: {
        ...createTradeManagerSummaryPortfolio(),
        balanceSummary: {
          ...createTradeManagerSummaryPortfolio().balanceSummary,
          tradingBalanceQuote: 1n,
        },
      },
    });

    const missingOutcome = await beginWithdrawReview(missingSummary.result);
    const insufficientOutcome = await beginWithdrawReview(insufficient.result);

    expect(missingOutcome.ok).toBe(false);
    expect(insufficientOutcome.ok).toBe(false);
    if (!missingOutcome.ok && !insufficientOutcome.ok) {
      expect(missingOutcome.error.code).toBe('TODO_VERIFY_PATH_USED');
      expect(insufficientOutcome.error.code).toBe('INSUFFICIENT_MANAGER_DUSDC');
    }
  });

  it('maps wallet rejection to TRANSACTION_REJECTED for manager withdraw', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderWithdrawFlow({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginWithdrawReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
  });

  it('keeps a manager deposit digest visible when refresh invalidation fails', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const { result } = renderDepositFlow({
      executionTransport: createTradeExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginDepositReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });
});

function renderCreateManagerFlow({
  executionTransport,
  hasExistingManager = false,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  hasExistingManager?: boolean;
  queryClient?: Parameters<typeof useCreateManagerFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  return renderHook(
    () =>
      useCreateManagerFlow({
        executionTransport,
        hasExistingManager,
        queryClient,
        simulationTransport,
        walletStatus,
      }),
    { wrapper: createQueryWrapper() },
  );
}

function renderDepositFlow({
  executionTransport,
  managerId = tradeTestManagerId,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletDusdcBalanceQuote = 2_000_000n,
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  managerId?: Parameters<typeof useManagerDepositFlow>[0]['managerId'];
  queryClient?: Parameters<typeof useManagerDepositFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  return renderHook(
    () =>
      useManagerDepositFlow({
        executionTransport,
        managerId,
        queryClient,
        simulationTransport,
        walletDusdcBalanceQuote,
        walletStatus,
      }),
    { wrapper: createQueryWrapper() },
  );
}

function renderWithdrawFlow({
  executionTransport,
  managerId = tradeTestManagerId,
  managerSummary = createTradeManagerSummaryPortfolio(),
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  managerId?: Parameters<typeof useManagerWithdrawFlow>[0]['managerId'];
  managerSummary?: Parameters<typeof useManagerWithdrawFlow>[0]['managerSummary'];
  queryClient?: Parameters<typeof useManagerWithdrawFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  return renderHook(
    () =>
      useManagerWithdrawFlow({
        executionTransport,
        managerId,
        managerSummary,
        queryClient,
        simulationTransport,
        walletStatus,
      }),
    { wrapper: createQueryWrapper() },
  );
}

function createQueryWrapper() {
  const providerClient = new QueryClient({
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
    return <QueryClientProvider client={providerClient}>{children}</QueryClientProvider>;
  }

  return TestQueryProvider;
}

async function beginCreateManagerReview(
  result: ReturnType<typeof renderCreateManagerFlow>['result'],
) {
  let outcome: Awaited<ReturnType<typeof result.current.beginCreateManagerReview>> | undefined;

  await act(async () => {
    outcome = await result.current.beginCreateManagerReview(undefined);
  });

  if (outcome === undefined) {
    throw new Error('Create manager review did not return an outcome.');
  }

  return outcome;
}

async function beginDepositReview(
  result: ReturnType<typeof renderDepositFlow>['result'],
  input?: BeginManagerDepositReviewInput,
) {
  let outcome: Awaited<ReturnType<typeof result.current.beginDepositReview>> | undefined;

  await act(async () => {
    outcome = await result.current.beginDepositReview(input ?? defaultDepositReviewInput);
  });

  if (outcome === undefined) {
    throw new Error('Deposit review did not return an outcome.');
  }

  return outcome;
}

async function beginWithdrawReview(
  result: ReturnType<typeof renderWithdrawFlow>['result'],
  input?: BeginManagerWithdrawReviewInput,
) {
  let outcome: Awaited<ReturnType<typeof result.current.beginWithdrawReview>> | undefined;

  await act(async () => {
    outcome = await result.current.beginWithdrawReview(input ?? defaultWithdrawReviewInput);
  });

  if (outcome === undefined) {
    throw new Error('Withdraw review did not return an outcome.');
  }

  return outcome;
}
