import type { ReactNode } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  usePredictTradeExecutionFlow,
  type PredictSubmittedTransactionRecoveryResult,
  type PredictTradeRiskPreview,
  type PredictTradeTxPreviewBase,
  type PreparePredictTradeReviewResult,
} from '@/features/trade/actions/usePredictTradeExecutionFlow';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { ObjectId, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import type { AffectedObjectHint, PredictTransactionExecutionRequest } from '@/types/tx';

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

const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId = '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as ObjectId;
const quantityQuote = 1_000_000n as QuoteAmount;

interface TestTradePreview extends PredictTradeTxPreviewBase {
  managerId: ObjectId;
  title: string;
}

describe('usePredictTradeExecutionFlow security hardening', () => {
  it('blocks duplicate review attempts before a second build or simulation starts', async () => {
    let resolveReview: ((value: PreparePredictTradeReviewResult<TestTradePreview>) => void) | null =
      null;
    const prepareReview = vi.fn(
      () =>
        new Promise<PreparePredictTradeReviewResult<TestTradePreview>>((resolve) => {
          resolveReview = resolve;
        }),
    );
    const simulationTransport = createReadySimulationTransport();
    const { result } = renderSharedFlow({
      prepareReview,
      simulationTransport,
    });

    let firstReview: Promise<Awaited<ReturnType<typeof result.current.beginReview>>> | undefined;
    act(() => {
      firstReview = result.current.beginReview(undefined);
    });
    if (firstReview === undefined) {
      throw new Error('expected first review promise');
    }

    let secondOutcome: Awaited<ReturnType<typeof result.current.beginReview>> | undefined;
    await act(async () => {
      secondOutcome = await result.current.beginReview(undefined);
    });
    if (secondOutcome === undefined) {
      throw new Error('expected second review outcome');
    }

    expect(secondOutcome.ok).toBe(false);
    if (!secondOutcome.ok) {
      expect(secondOutcome.error.message).toBe(
        'Another transaction review or wallet request is already in progress.',
      );
    }
    expect(prepareReview).toHaveBeenCalledTimes(1);
    expect(simulationTransport.simulateTransaction).not.toHaveBeenCalled();

    await act(async () => {
      resolveReview?.(createPreparedReview());
      await firstReview;
    });

    expect(result.current.state.phase).toBe('ready');
    expect(simulationTransport.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks stale preview signing and never calls wallet transport', async () => {
    let currentNowMs = 1_000;
    const executionTransport = createExecutionTransport();
    const { result } = renderSharedFlow({
      executionTransport,
      nowMs: () => currentNowMs,
      previewTtlMs: 100,
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    expect(result.current.state.phase).toBe('ready');

    currentNowMs = 1_101;
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.message).toBe('The transaction preview is stale.');
    expect(executionTransport.signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it('preserves success and refresh warning behavior after guarded signing', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const executionTransport = createExecutionTransport();
    const { result } = renderSharedFlow({
      executionTransport,
      queryClient: { invalidateQueries },
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['security-flow', managerId],
    });
  });

  it('recovers an indexed digest before the wallet return timeout when the wallet promise hangs', async () => {
    const executionTransport = createPendingExecutionTransport();
    const recoverSubmittedTransaction = vi
      .fn()
      .mockResolvedValue(createRecoveredDigest('indexed-recovery-digest'));
    const { result } = renderSharedFlow({
      executionTransport,
      recoverSubmittedTransaction,
      walletRecoveryNoticeDelayMs: 0,
      walletReturnTimeoutMs: 10_000,
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('indexed-recovery-digest');
    expect(recoverSubmittedTransaction).toHaveBeenCalledTimes(1);
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
  });

  it('lets strict recovery win when wallet handoff returns a generic no-digest error', async () => {
    const executionTransport = createGenericFailedExecutionTransport();
    const recoverSubmittedTransaction = vi
      .fn()
      .mockResolvedValue(createRecoveredDigest('generic-failure-recovered-digest'));
    const { result } = renderSharedFlow({
      executionTransport,
      recoverSubmittedTransaction,
      walletRecoveryNoticeDelayMs: 0,
      walletReturnTimeoutMs: 10_000,
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('generic-failure-recovered-digest');
    expect(result.current.state.error).toBeNull();
    expect(recoverSubmittedTransaction).toHaveBeenCalledTimes(1);
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps wallet rejection precedence when no digest has been recovered', async () => {
    const executionTransport = createRejectedExecutionTransport();
    const recoverSubmittedTransaction = vi.fn(
      () => new Promise<PredictSubmittedTransactionRecoveryResult | null>(() => undefined),
    );
    const { result } = renderSharedFlow({
      executionTransport,
      recoverSubmittedTransaction,
      walletReturnTimeoutMs: 10_000,
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
    expect(result.current.state.completedDigest).toBeNull();
    expect(recoverSubmittedTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns wallet response timeout when recovery finds no submitted proof', async () => {
    const executionTransport = createPendingExecutionTransport();
    const recoverSubmittedTransaction = vi.fn().mockResolvedValue(null);
    const { result } = renderSharedFlow({
      executionTransport,
      recoverSubmittedTransaction,
      walletRecoveryNoticeDelayMs: 0,
      walletReturnTimeoutMs: 1,
    });

    await act(async () => {
      await result.current.beginReview(undefined);
    });
    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('WALLET_RESPONSE_TIMEOUT');
    expect(result.current.state.completedDigest).toBeNull();
  });
});

function renderSharedFlow({
  executionTransport = createExecutionTransport(),
  nowMs,
  prepareReview = vi.fn().mockResolvedValue(createPreparedReview()),
  previewTtlMs,
  queryClient,
  recoverSubmittedTransaction,
  simulationTransport = createReadySimulationTransport(),
  walletRecoveryNoticeDelayMs,
  walletReturnTimeoutMs,
}: {
  executionTransport?: PredictTransactionTransport;
  nowMs?: () => number;
  prepareReview?: () => Promise<PreparePredictTradeReviewResult<TestTradePreview>>;
  previewTtlMs?: number;
  queryClient?: Parameters<typeof usePredictTradeExecutionFlow>[0]['queryClient'];
  recoverSubmittedTransaction?: Parameters<
    typeof usePredictTradeExecutionFlow<undefined, TestTradePreview>
  >[0]['recoverSubmittedTransaction'];
  simulationTransport?: PredictSimulationTransport;
  walletRecoveryNoticeDelayMs?: number;
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
      usePredictTradeExecutionFlow<undefined, TestTradePreview>({
        action: 'MINT',
        copy: {
          signatureNotReadyMessage: 'Security test signature is not ready.',
          statusLabel: 'Security flow',
        },
        executionTransport,
        nowMs,
        prepareReview,
        previewTtlMs,
        queryClient,
        recoverSubmittedTransaction,
        simulationTransport,
        walletRecoveryNoticeDelayMs,
        walletReturnTimeoutMs,
      }),
    { wrapper },
  );
}

function createPreparedReview(): PreparePredictTradeReviewResult<TestTradePreview> {
  const affectedObjects: AffectedObjectHint[] = [
    {
      id: managerId,
      kind: 'manager',
      label: 'PredictManager',
    },
  ];

  return {
    builderPreview: {
      action: 'MINT',
      affectedObjects,
      managerId,
      postTransactionRefreshKeys: [['security-flow', managerId]],
      quantityQuote,
      sender,
      title: 'Security flow preview',
    },
    executionRequest: createExecutionRequest(affectedObjects),
    ok: true,
    riskPreview: {
      action: 'MINT',
      managerId,
      quantityQuote,
      title: 'Security flow risk preview',
    } satisfies PredictTradeRiskPreview,
    warnings: [],
  };
}

function createExecutionRequest(
  affectedObjects: AffectedObjectHint[],
): PredictTransactionExecutionRequest {
  return {
    action: 'MINT',
    affectedObjects,
    description: 'Security flow request',
    sender,
    transaction: new Transaction(),
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
        events: [{ type: 'mint' }],
        objectTypes: {
          [managerId]: 'predict_manager::PredictManager',
        },
      },
      commandResults: [{ mutatedReferences: [], returnValues: [{ bcs: new Uint8Array([1]) }] }],
    }),
  };
}

function createExecutionTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest: 'tx-digest',
        effects: { status: { status: 'success' } },
      },
    }),
    waitForTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest: 'tx-digest',
        effects: { status: { status: 'success' } },
      },
    }),
  };
}

function createPendingExecutionTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn(() => new Promise<never>(() => undefined)),
  };
}

function createGenericFailedExecutionTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('Wallet handoff closed')),
  };
}

function createRejectedExecutionTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
  };
}

function createRecoveredDigest(
  digest: TransactionDigest,
): PredictSubmittedTransactionRecoveryResult {
  return {
    affectedObjects: [{ id: managerId, kind: 'manager', label: 'PredictManager' }],
    confirmedStatus: 'unknown',
    digest,
  };
}
