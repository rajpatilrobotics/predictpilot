import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  useRangeMintFlow,
  type BeginRangeMintReviewInput,
} from '@/features/trade/actions/useRangeMintFlow';
import {
  useRangeRedeemFlow,
  type BeginRangeRedeemReviewInput,
} from '@/features/trade/actions/useRangeRedeemFlow';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount, RangeKeyModel } from '@/types/predict';
import {
  createReadyTradeSimulationTransport,
  createTradeExecutionTransport,
  createTradeManagerState,
  createTradeManagerSummary,
  createTradeOracleState,
  createTradeRangePosition,
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

describe('range execution flows', () => {
  it('blocks disconnected wallets, wrong networks, missing managers, and missing summaries', async () => {
    const disconnected = renderRangeMintFlow({
      walletStatus: createTradeWalletStatus({
        accountAddress: null,
        isConnected: false,
        isDisconnected: true,
        shortAddress: null,
        status: 'disconnected',
      }),
    });
    const wrongNetwork = renderRangeMintFlow({
      walletStatus: createTradeWalletStatus({
        currentNetwork: 'mainnet',
        isExpectedNetwork: false,
        isWrongNetwork: true,
      }),
    });
    const noManager = renderRangeMintFlow({
      manager: createTradeManagerState({
        authoritativeObject: null,
        isReady: false,
        manager: null,
        managerId: null,
        owner: null,
        status: 'NO_MANAGER',
      }),
    });
    const noSummary = renderRangeMintFlow({ managerSummary: null });

    const outcomes = [
      await beginMintReview(disconnected.result),
      await beginMintReview(wrongNetwork.result),
      await beginMintReview(noManager.result),
      await beginMintReview(noSummary.result),
    ];

    expect(outcomes.map((outcome) => (outcome.ok ? null : outcome.error.code))).toEqual([
      'WALLET_NOT_CONNECTED',
      'WRONG_NETWORK',
      'MANAGER_NOT_FOUND',
      'MANAGER_NOT_FOUND',
    ]);
    expect(dAppKitMocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it('blocks invalid range keys and invalid quantities before simulation', async () => {
    const invalidRange = renderRangeMintFlow();
    const invalidRangeOutcome = await beginMintReview(invalidRange.result, {
      rangeKey: createInvalidRangeKey(),
    });

    const invalidQuantity = renderRangeMintFlow();
    const invalidQuantityOutcome = await beginMintReview(invalidQuantity.result, {
      quantityQuote: 0n,
    });

    expect(invalidRangeOutcome.ok).toBe(false);
    expect(invalidQuantityOutcome.ok).toBe(false);
    if (!invalidRangeOutcome.ok && !invalidQuantityOutcome.ok) {
      expect(invalidRangeOutcome.error.code).toBe('INVALID_RANGE');
      expect(invalidQuantityOutcome.error.code).toBe('INVALID_INPUT');
    }
  });

  it('blocks stale oracles before range execution', async () => {
    const stale = renderRangeMintFlow({
      oracleState: createTradeOracleState({
        priceTimestampMs: tradeTestNowMs - 90_000,
        sviTimestampMs: tradeTestNowMs - 90_000,
      }),
    });

    const outcome = await beginMintReview(stale.result);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('ORACLE_STALE');
    }
  });

  it('builds and simulates a valid range mint before enabling signature', async () => {
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderRangeMintFlow({ simulationTransport });

    const outcome = await beginMintReview(result);

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
      action: 'MINT_RANGE',
      managerId: tradeTestManagerId,
      oracleId: tradeTestOracleId,
    });
  });

  it('blocks range redeem when no matching position or not enough quantity exists', async () => {
    const missingPosition = renderRangeRedeemFlow();
    const missingPositionOutcome = await beginRedeemReview(missingPosition.result, {
      ownedRangePosition: null,
    });

    const smallPosition = createTradeRangePosition({
      quantityQuote: 500_000n,
    });
    const tooLarge = renderRangeRedeemFlow();
    const tooLargeOutcome = await beginRedeemReview(tooLarge.result, {
      ownedRangePosition: smallPosition,
      quantityQuote,
      rangeKey: smallPosition.key,
    });

    expect(missingPositionOutcome.ok).toBe(false);
    expect(tooLargeOutcome.ok).toBe(false);
    if (!missingPositionOutcome.ok && !tooLargeOutcome.ok) {
      expect(missingPositionOutcome.error.message).toMatch(/open range position/i);
      expect(tooLargeOutcome.error.message).toMatch(/exceeds the open range position/i);
    }
  });

  it('builds and simulates a valid range redeem before enabling signature', async () => {
    const simulationTransport = createReadyTradeSimulationTransport();
    const { result } = renderRangeRedeemFlow({ simulationTransport });

    const outcome = await beginRedeemReview(result);

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
      action: 'REDEEM_RANGE',
      managerId: tradeTestManagerId,
      oracleId: tradeTestOracleId,
    });
  });

  it('maps wallet rejection to TRANSACTION_REJECTED', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderRangeMintFlow({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginMintReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
  });

  it('stores digest and invalidates affected Predict queries after success', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport();
    const { result } = renderRangeMintFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginMintReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps digest visible when post-submit query invalidation fails', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const { result } = renderRangeMintFlow({
      executionTransport: createTradeExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginMintReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });

  it('recovers a submitted range mint digest when wallet handoff does not return', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const signAndExecuteTransaction = vi.fn(() => new Promise<never>(() => undefined));
    const waitForTransaction = vi.fn();
    const historyClient = createHistoryClient({
      fetchRangeMintHistoryDto: vi.fn().mockImplementation(() =>
        Promise.resolve([
          rangeMintDto({
            checkpoint_timestamp_ms: Date.now() + 1_000,
            digest: 'recovered-range-mint-digest',
          }),
        ]),
      ),
    });
    const { result } = renderRangeMintFlow({
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
    await beginMintReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('recovered-range-mint-digest');
    expect(result.current.state.executionResult).toMatchObject({
      confirmedStatus: 'success',
      digest: 'recovered-range-mint-digest',
      status: 'success',
    });
    expect(invalidateQueries).toHaveBeenCalled();
    expect(signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(waitForTransaction).not.toHaveBeenCalled();
  });
});

function renderRangeMintFlow({
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
  queryClient?: Parameters<typeof useRangeMintFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  tradeRecoveryMaxAttempts?: number;
  tradeRecoveryPollDelayMs?: number;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
  walletReturnTimeoutMs?: number;
} = {}) {
  const wrapper = createQueryWrapper();

  return renderHook(
    () =>
      useRangeMintFlow({
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

function renderRangeRedeemFlow({
  executionTransport,
  manager = createTradeManagerState(),
  managerSummary = createTradeManagerSummary(),
  oracleState = createTradeOracleState(),
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  manager?: ReturnType<typeof createTradeManagerState>;
  managerSummary?: ReturnType<typeof createTradeManagerSummary> | null;
  oracleState?: ReturnType<typeof createTradeOracleState>;
  queryClient?: Parameters<typeof useRangeRedeemFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  const wrapper = createQueryWrapper();

  return renderHook(
    () =>
      useRangeRedeemFlow({
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

async function beginMintReview(
  result: ReturnType<typeof renderRangeMintFlow>['result'],
  input: Partial<BeginRangeMintReviewInput> = {},
) {
  let outcome: Awaited<ReturnType<ReturnType<typeof useRangeMintFlow>['beginMintRangeReview']>>;

  await act(async () => {
    outcome = await result.current.beginMintRangeReview({
      quantityQuote: input.quantityQuote === undefined ? quantityQuote : input.quantityQuote,
      rangeKey: input.rangeKey === undefined ? createRangeKey() : input.rangeKey,
    });
  });

  return outcome!;
}

async function beginRedeemReview(
  result: ReturnType<typeof renderRangeRedeemFlow>['result'],
  input: Partial<BeginRangeRedeemReviewInput> = {},
) {
  const fallbackPosition = createTradeRangePosition();
  const ownedRangePosition = Object.hasOwn(input, 'ownedRangePosition')
    ? input.ownedRangePosition
    : fallbackPosition;
  const rangeKey =
    input.rangeKey === undefined
      ? (ownedRangePosition?.key ?? fallbackPosition.key)
      : input.rangeKey;
  let outcome: Awaited<ReturnType<ReturnType<typeof useRangeRedeemFlow>['beginRedeemRangeReview']>>;

  await act(async () => {
    outcome = await result.current.beginRedeemRangeReview({
      ownedRangePosition,
      quantityQuote: input.quantityQuote === undefined ? quantityQuote : input.quantityQuote,
      rangeKey,
    });
  });

  return outcome!;
}

function createQueryWrapper() {
  const providerClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={providerClient}>{children}</QueryClientProvider>;
  };
}

function createRangeKey(): RangeKeyModel {
  return createTradeRangePosition().key;
}

function createInvalidRangeKey(): RangeKeyModel {
  const rangeKey = createRangeKey();

  return {
    ...rangeKey,
    higherStrike1e9: rangeKey.lowerStrike1e9,
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

function rangeMintDto({
  checkpoint_timestamp_ms = tradeTestNowMs,
  digest = 'range-mint-digest',
}: {
  checkpoint_timestamp_ms?: number;
  digest?: string;
}) {
  const rangeKey = createRangeKey();

  return {
    event_digest: `${digest}-event`,
    digest,
    sender: tradeTestOwner,
    checkpoint: 1,
    checkpoint_timestamp_ms,
    tx_index: 0,
    event_index: 0,
    package: predictDeploymentConfig.packageId,
    ask_price: 901_396_381,
    cost: 45_069,
    expiry: String(rangeKey.expiryMs),
    higher_strike: String(rangeKey.higherStrike1e9),
    lower_strike: String(rangeKey.lowerStrike1e9),
    manager_id: tradeTestManagerId,
    oracle_id: rangeKey.oracleId,
    predict_id: predictDeploymentConfig.predictObjectId,
    quantity: String(quantityQuote),
    quote_asset: predictDeploymentConfig.quoteAsset.type,
    trader: tradeTestOwner,
  };
}
