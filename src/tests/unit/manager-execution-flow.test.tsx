import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { useCreateManagerFlow } from '@/features/manager/actions/useCreateManagerFlow';
import {
  useManagerDepositFlow,
  type BeginManagerDepositReviewInput,
} from '@/features/manager/actions/useManagerDepositFlow';
import {
  useManagerWithdrawFlow,
  type BeginManagerWithdrawReviewInput,
} from '@/features/manager/actions/useManagerWithdrawFlow';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';
import type { AuthoritativeSuiClient } from '@/integrations/deepbook-predict/onchain/objects';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
  createTradeExecutionTransport,
  createTradeManagerSummaryPortfolio,
  createTradeWalletStatus,
  tradeTestManagerId,
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

  it('recovers a create-manager digest when wallet approval does not return to the app', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockImplementation(createNeverResolvingWalletPromise),
    });
    const indexedClient = createManagerIndexClient([
      createManagerCreatedDto({ digest: 'recovered-create-digest' }),
    ]);
    const { result } = renderCreateManagerFlow({
      executionTransport,
      indexedClient,
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 1,
    });
    await beginCreateManagerReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    const invalidatedText = JSON.stringify(invalidateQueries.mock.calls);

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-create-digest');
    expect(result.current.state.executionNotice).toBeNull();
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-create-digest',
      status: 'success',
    });
    expect(invalidatedText).toContain('manager');
  });

  it('shows a safe timeout when create-manager wallet recovery cannot prove submission', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockImplementation(createNeverResolvingWalletPromise),
    });
    const indexedClient = createManagerIndexClient([]);
    const { result } = renderCreateManagerFlow({
      executionTransport,
      indexedClient,
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 1,
    });
    await beginCreateManagerReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('WALLET_RESPONSE_TIMEOUT');
    expect(result.current.state.completedDigest).toBeNull();
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

  it('recovers a manager deposit digest when wallet approval does not return to the app', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockImplementation(createNeverResolvingWalletPromise),
    });
    const authoritativeClient = createAuthoritativeManagerClient({
      previousTransaction: 'recovered-deposit-digest',
    });
    const indexedClient = createManagerSummaryClient({
      tradingBalance: '1000000',
    });
    const { result } = renderDepositFlow({
      authoritativeClient,
      executionTransport,
      indexedClient,
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      previousManagerTransactionDigest: 'old-manager-digest',
      previousTradingBalanceQuote: 0n,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 1,
    });
    await beginDepositReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    const invalidatedText = JSON.stringify(invalidateQueries.mock.calls);

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-deposit-digest');
    expect(result.current.state.executionNotice).toBeNull();
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-deposit-digest',
      status: 'success',
    });
    expect(authoritativeClient.getObject).toHaveBeenCalledOnce();
    expect(indexedClient.fetchManagerSummaryDto).toHaveBeenCalledWith(tradeTestManagerId);
    expect(invalidatedText).toContain('manager');
  });

  it('recovers a manager deposit digest after an early empty recovery and no-digest wallet error', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('Wallet handoff closed')),
    });
    const authoritativeClient = createAuthoritativeManagerClientSequence([
      'old-manager-digest',
      'late-recovered-deposit-digest',
    ]);
    const indexedClient = createManagerSummaryClientSequence(['1000000']);
    const { result } = renderDepositFlow({
      authoritativeClient,
      executionTransport,
      indexedClient,
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      previousManagerTransactionDigest: 'old-manager-digest',
      previousTradingBalanceQuote: 0n,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 10_000,
    });
    await beginDepositReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    const invalidatedText = JSON.stringify(invalidateQueries.mock.calls);

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('late-recovered-deposit-digest');
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'late-recovered-deposit-digest',
      status: 'success',
    });
    expect(authoritativeClient.getObject).toHaveBeenCalledTimes(2);
    expect(indexedClient.fetchManagerSummaryDto).toHaveBeenCalledWith(tradeTestManagerId);
    expect(invalidatedText).toContain('manager');
  });

  it('times out manager deposit recovery when manager state does not prove a new deposit', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockImplementation(createNeverResolvingWalletPromise),
    });
    const { result } = renderDepositFlow({
      authoritativeClient: createAuthoritativeManagerClient({
        previousTransaction: 'old-manager-digest',
      }),
      executionTransport,
      indexedClient: createManagerSummaryClient({
        tradingBalance: '1000000',
      }),
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      previousManagerTransactionDigest: 'old-manager-digest',
      previousTradingBalanceQuote: 0n,
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 1,
    });
    await beginDepositReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('WALLET_RESPONSE_TIMEOUT');
    expect(result.current.state.completedDigest).toBeNull();
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

  it('recovers a manager withdraw digest when wallet approval does not return to the app', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockImplementation(createNeverResolvingWalletPromise),
    });
    const { result } = renderWithdrawFlow({
      authoritativeClient: createAuthoritativeManagerClient({
        previousTransaction: 'recovered-withdraw-digest',
      }),
      executionTransport,
      indexedClient: createManagerSummaryClient({
        tradingBalance: '4000000',
      }),
      managerRecoveryMaxAttempts: 1,
      managerRecoveryPollDelayMs: 0,
      previousManagerTransactionDigest: 'old-manager-digest',
      simulationTransport: createReadyTradeSimulationTransport(),
      walletReturnTimeoutMs: 1,
    });
    await beginWithdrawReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-withdraw-digest');
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-withdraw-digest',
      status: 'success',
    });
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
  indexedClient,
  managerRecoveryMaxAttempts,
  managerRecoveryPollDelayMs,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletStatus = createTradeWalletStatus(),
  walletReturnTimeoutMs,
}: {
  executionTransport?: PredictTransactionTransport;
  hasExistingManager?: boolean;
  indexedClient?: PortfolioReadClient;
  managerRecoveryMaxAttempts?: number;
  managerRecoveryPollDelayMs?: number;
  queryClient?: Parameters<typeof useCreateManagerFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
  walletReturnTimeoutMs?: number;
} = {}) {
  return renderHook(
    () =>
      useCreateManagerFlow({
        executionTransport,
        hasExistingManager,
        indexedClient,
        managerRecoveryMaxAttempts,
        managerRecoveryPollDelayMs,
        queryClient,
        simulationTransport,
        walletStatus,
        walletReturnTimeoutMs,
      }),
    { wrapper: createQueryWrapper() },
  );
}

function renderDepositFlow({
  authoritativeClient,
  executionTransport,
  indexedClient,
  managerId = tradeTestManagerId,
  managerRecoveryMaxAttempts,
  managerRecoveryPollDelayMs,
  previousManagerTransactionDigest,
  previousTradingBalanceQuote,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletDusdcBalanceQuote = 2_000_000n,
  walletStatus = createTradeWalletStatus(),
  walletReturnTimeoutMs,
}: {
  authoritativeClient?: AuthoritativeSuiClient;
  executionTransport?: PredictTransactionTransport;
  indexedClient?: PortfolioReadClient;
  managerId?: Parameters<typeof useManagerDepositFlow>[0]['managerId'];
  managerRecoveryMaxAttempts?: number;
  managerRecoveryPollDelayMs?: number;
  previousManagerTransactionDigest?: Parameters<
    typeof useManagerDepositFlow
  >[0]['previousManagerTransactionDigest'];
  previousTradingBalanceQuote?: QuoteAmount | null;
  queryClient?: Parameters<typeof useManagerDepositFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
  walletReturnTimeoutMs?: number;
} = {}) {
  return renderHook(
    () =>
      useManagerDepositFlow({
        authoritativeClient,
        executionTransport,
        indexedClient,
        managerId,
        managerRecoveryMaxAttempts,
        managerRecoveryPollDelayMs,
        previousManagerTransactionDigest,
        previousTradingBalanceQuote,
        queryClient,
        simulationTransport,
        walletDusdcBalanceQuote,
        walletStatus,
        walletReturnTimeoutMs,
      }),
    { wrapper: createQueryWrapper() },
  );
}

function renderWithdrawFlow({
  authoritativeClient,
  executionTransport,
  indexedClient,
  managerId = tradeTestManagerId,
  managerRecoveryMaxAttempts,
  managerRecoveryPollDelayMs,
  managerSummary = createTradeManagerSummaryPortfolio(),
  previousManagerTransactionDigest,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletStatus = createTradeWalletStatus(),
  walletReturnTimeoutMs,
}: {
  authoritativeClient?: AuthoritativeSuiClient;
  executionTransport?: PredictTransactionTransport;
  indexedClient?: PortfolioReadClient;
  managerId?: Parameters<typeof useManagerWithdrawFlow>[0]['managerId'];
  managerRecoveryMaxAttempts?: number;
  managerRecoveryPollDelayMs?: number;
  managerSummary?: Parameters<typeof useManagerWithdrawFlow>[0]['managerSummary'];
  previousManagerTransactionDigest?: Parameters<
    typeof useManagerWithdrawFlow
  >[0]['previousManagerTransactionDigest'];
  queryClient?: Parameters<typeof useManagerWithdrawFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
  walletReturnTimeoutMs?: number;
} = {}) {
  return renderHook(
    () =>
      useManagerWithdrawFlow({
        authoritativeClient,
        executionTransport,
        indexedClient,
        managerId,
        managerRecoveryMaxAttempts,
        managerRecoveryPollDelayMs,
        managerSummary,
        previousManagerTransactionDigest,
        queryClient,
        simulationTransport,
        walletStatus,
        walletReturnTimeoutMs,
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

function createNeverResolvingWalletPromise() {
  return new Promise<never>((resolve) => {
    void resolve;
  });
}

function createManagerIndexClient(managers: Array<ReturnType<typeof createManagerCreatedDto>>) {
  return {
    fetchManagersDto: vi.fn().mockResolvedValue(managers),
  } as unknown as PortfolioReadClient;
}

function createManagerSummaryClient({
  tradingBalance,
}: {
  tradingBalance: string;
}): PortfolioReadClient {
  return {
    fetchManagerSummaryDto: vi.fn().mockResolvedValue(createManagerSummaryDto({ tradingBalance })),
  } as unknown as PortfolioReadClient;
}

function createManagerSummaryClientSequence(tradingBalances: string[]): PortfolioReadClient {
  const fallbackTradingBalance = tradingBalances[tradingBalances.length - 1] ?? '0';
  const fetchManagerSummaryDto = vi.fn();

  tradingBalances.forEach((tradingBalance) => {
    fetchManagerSummaryDto.mockResolvedValueOnce(createManagerSummaryDto({ tradingBalance }));
  });
  fetchManagerSummaryDto.mockResolvedValue(
    createManagerSummaryDto({
      tradingBalance: fallbackTradingBalance,
    }),
  );

  return {
    fetchManagerSummaryDto,
  } as unknown as PortfolioReadClient;
}

function createAuthoritativeManagerClient({
  previousTransaction,
}: {
  previousTransaction: string | null;
}): AuthoritativeSuiClient {
  return {
    getObject: vi.fn().mockResolvedValue(createAuthoritativeManagerObject(previousTransaction)),
    listCoins: vi.fn(),
  };
}

function createAuthoritativeManagerClientSequence(
  previousTransactions: Array<string | null>,
): AuthoritativeSuiClient {
  const fallbackPreviousTransaction = previousTransactions[previousTransactions.length - 1] ?? null;
  const getObject = vi.fn();

  previousTransactions.forEach((previousTransaction) => {
    getObject.mockResolvedValueOnce(createAuthoritativeManagerObject(previousTransaction));
  });
  getObject.mockResolvedValue(createAuthoritativeManagerObject(fallbackPreviousTransaction));

  return {
    getObject,
    listCoins: vi.fn(),
  };
}

function createManagerSummaryDto({ tradingBalance }: { tradingBalance: string }) {
  return {
    account_value: tradingBalance,
    awaiting_settlement_positions: 0,
    balances: [
      {
        balance: tradingBalance,
        quote_asset: predictDeploymentConfig.quoteAsset.type,
      },
    ],
    manager_id: tradeTestManagerId,
    open_exposure: '0',
    open_positions: 0,
    owner: tradeTestOwner,
    realized_pnl: '0',
    redeemable_value: '0',
    trading_balance: tradingBalance,
    unrealized_pnl: '0',
  };
}

function createAuthoritativeManagerObject(previousTransaction: string | null) {
  return {
    object: {
      digest: 'manager-object-digest',
      json: null,
      objectId: tradeTestManagerId,
      owner: tradeTestOwner,
      previousTransaction,
      type: `${predictDeploymentConfig.packageId}::predict_manager::PredictManager`,
      version: '2',
    },
  };
}

function createManagerCreatedDto({
  digest = 'manager-created-digest',
  timestampMs = Date.now(),
}: {
  digest?: string;
  timestampMs?: number;
} = {}) {
  return {
    checkpoint: '100',
    checkpoint_timestamp_ms: String(timestampMs),
    digest,
    event_digest: `${digest}-event`,
    event_index: 0,
    manager_id: tradeTestManagerId,
    owner: tradeTestOwner,
    package: predictDeploymentConfig.packageId,
    sender: tradeTestOwner,
    tx_index: 0,
  };
}
