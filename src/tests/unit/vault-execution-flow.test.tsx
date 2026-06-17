import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  useVaultSupplyFlow,
  type BeginVaultSupplyReviewInput,
} from '@/features/vault/actions/useVaultSupplyFlow';
import {
  useVaultWithdrawFlow,
  type BeginVaultWithdrawReviewInput,
} from '@/features/vault/actions/useVaultWithdrawFlow';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { QuoteAmount } from '@/types/predict';
import type { VaultModel } from '@/types/vault';
import {
  createReadyTradeSimulationTransport,
  createTradeExecutionTransport,
  createTradeWalletStatus,
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

const supplyAmount = 1_000_000n as QuoteAmount;
const plpAmount = 1_000_000n;

beforeEach(() => {
  dAppKitMocks.signAndExecuteTransaction.mockReset();
  dAppKitMocks.simulateTransaction.mockReset();
  dAppKitMocks.waitForTransaction.mockReset();
});

describe('vault execution flows', () => {
  it('blocks disconnected wallets, wrong networks, missing vault state, and missing balances', async () => {
    const disconnected = renderVaultSupplyFlow({
      walletStatus: createTradeWalletStatus({
        accountAddress: null,
        isConnected: false,
        isDisconnected: true,
        shortAddress: null,
        status: 'disconnected',
      }),
    });
    const wrongNetwork = renderVaultSupplyFlow({
      walletStatus: createTradeWalletStatus({
        currentNetwork: 'mainnet',
        isExpectedNetwork: false,
        isWrongNetwork: true,
      }),
    });
    const missingVault = renderVaultSupplyFlow({ vault: null });
    const missingBalance = renderVaultSupplyFlow({ walletDusdcBalanceQuote: null });

    const outcomes = [
      await beginSupplyReview(disconnected.result),
      await beginSupplyReview(wrongNetwork.result),
      await beginSupplyReview(missingVault.result),
      await beginSupplyReview(missingBalance.result),
    ];

    expect(outcomes.map((outcome) => (outcome.ok ? null : outcome.error.code))).toEqual([
      'WALLET_NOT_CONNECTED',
      'WRONG_NETWORK',
      'TODO_VERIFY_PATH_USED',
      'TODO_VERIFY_PATH_USED',
    ]);
    expect(dAppKitMocks.simulateTransaction).not.toHaveBeenCalled();
  });

  it('blocks insufficient DUSDC for supply and invalid supply amounts', async () => {
    const insufficient = renderVaultSupplyFlow({ walletDusdcBalanceQuote: 1n });
    const invalid = renderVaultSupplyFlow();

    const insufficientOutcome = await beginSupplyReview(insufficient.result);
    const invalidOutcome = await beginSupplyReview(invalid.result, { amountQuote: 0n });

    expect(insufficientOutcome.ok).toBe(false);
    expect(invalidOutcome.ok).toBe(false);
    if (!insufficientOutcome.ok && !invalidOutcome.ok) {
      expect(insufficientOutcome.error.code).toBe('INSUFFICIENT_WALLET_DUSDC');
      expect(invalidOutcome.error.code).toBe('INVALID_INPUT');
    }
  });

  it('blocks insufficient PLP and unavailable vault withdrawals', async () => {
    const insufficient = renderVaultWithdrawFlow({ walletPlpBalanceAtomic: 1n });
    const unavailable = renderVaultWithdrawFlow({
      vault: createVault({ availableWithdrawalQuote: 0n }),
    });

    const insufficientOutcome = await beginWithdrawReview(insufficient.result);
    const unavailableOutcome = await beginWithdrawReview(unavailable.result);

    expect(insufficientOutcome.ok).toBe(false);
    expect(unavailableOutcome.ok).toBe(false);
    if (!insufficientOutcome.ok && !unavailableOutcome.ok) {
      expect(insufficientOutcome.error.message).toMatch(/not have enough PLP/i);
      expect(unavailableOutcome.error.message).toMatch(/withdrawal is currently unavailable/i);
    }
  });

  it('builds and simulates supply and withdraw before enabling signature', async () => {
    const supplySimulation = createReadyTradeSimulationTransport();
    const withdrawSimulation = createReadyTradeSimulationTransport();
    const supply = renderVaultSupplyFlow({ simulationTransport: supplySimulation });
    const withdraw = renderVaultWithdrawFlow({ simulationTransport: withdrawSimulation });

    const supplyOutcome = await beginSupplyReview(supply.result);
    const withdrawOutcome = await beginWithdrawReview(withdraw.result);

    expect(supplyOutcome.ok).toBe(true);
    expect(withdrawOutcome.ok).toBe(true);
    expect(supplySimulation.simulateTransaction).toHaveBeenCalledOnce();
    expect(withdrawSimulation.simulateTransaction).toHaveBeenCalledOnce();
    expect(supply.result.current.canRequestSignature).toBe(true);
    expect(withdraw.result.current.canRequestSignature).toBe(true);
    expect(supply.result.current.state.riskPreview).toMatchObject({
      action: 'SUPPLY',
      amountQuote: supplyAmount,
    });
    expect(withdraw.result.current.state.riskPreview).toMatchObject({
      action: 'WITHDRAW',
      plpAmountAtomic: plpAmount,
    });
  });

  it('maps wallet rejection to TRANSACTION_REJECTED for vault supply', async () => {
    const executionTransport = createTradeExecutionTransport({
      signAndExecuteTransaction: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    const { result } = renderVaultSupplyFlow({
      executionTransport,
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginSupplyReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('failure');
    expect(result.current.state.error?.code).toBe('TRANSACTION_REJECTED');
  });

  it('stores digest and invalidates vault, history, and wallet balance queries after supply success', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const executionTransport = createTradeExecutionTransport();
    const { result } = renderVaultSupplyFlow({
      executionTransport,
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginSupplyReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    const invalidatedText = JSON.stringify(invalidateQueries.mock.calls);

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning).toBeNull();
    expect(executionTransport.signAndExecuteTransaction).toHaveBeenCalledOnce();
    expect(invalidatedText).toContain('vault');
    expect(invalidatedText).toContain('history');
    expect(invalidatedText).toContain('wallet-balances');
  });

  it('keeps withdraw digest visible when post-submit query invalidation fails', async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const { result } = renderVaultWithdrawFlow({
      executionTransport: createTradeExecutionTransport(),
      queryClient: { invalidateQueries },
      simulationTransport: createReadyTradeSimulationTransport(),
    });
    await beginWithdrawReview(result);

    await act(async () => {
      await result.current.requestSignature();
    });

    expect(result.current.state.phase).toBe('success');
    expect(result.current.state.completedDigest).toBe('tx-digest');
    expect(result.current.state.refreshWarning?.code).toBe('POST_TX_REFRESH_FAILED');
  });
});

function renderVaultSupplyFlow({
  executionTransport,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  vault = createVault(),
  walletDusdcBalanceQuote = 2_000_000n,
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  queryClient?: Parameters<typeof useVaultSupplyFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  vault?: VaultModel | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  const wrapper = createQueryWrapper();

  return renderHook(
    () =>
      useVaultSupplyFlow({
        executionTransport,
        queryClient,
        simulationTransport,
        vault,
        walletDusdcBalanceQuote,
        walletStatus,
      }),
    { wrapper },
  );
}

function renderVaultWithdrawFlow({
  executionTransport,
  queryClient,
  simulationTransport = createReadyTradeSimulationTransport(),
  vault = createVault(),
  walletPlpBalanceAtomic = 2_000_000n,
  walletStatus = createTradeWalletStatus(),
}: {
  executionTransport?: PredictTransactionTransport;
  queryClient?: Parameters<typeof useVaultWithdrawFlow>[0]['queryClient'];
  simulationTransport?: PredictSimulationTransport;
  vault?: VaultModel | null;
  walletPlpBalanceAtomic?: bigint | null;
  walletStatus?: ReturnType<typeof createTradeWalletStatus>;
} = {}) {
  const wrapper = createQueryWrapper();

  return renderHook(
    () =>
      useVaultWithdrawFlow({
        executionTransport,
        queryClient,
        simulationTransport,
        vault,
        walletPlpBalanceAtomic,
        walletStatus,
      }),
    { wrapper },
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

async function beginSupplyReview(
  result: ReturnType<typeof renderVaultSupplyFlow>['result'],
  input: BeginVaultSupplyReviewInput = { amountQuote: supplyAmount },
) {
  let outcome: Awaited<ReturnType<typeof result.current.beginSupplyReview>> | undefined;

  await act(async () => {
    outcome = await result.current.beginSupplyReview(input);
  });

  if (outcome === undefined) {
    throw new Error('Supply review did not return an outcome.');
  }

  return outcome;
}

async function beginWithdrawReview(
  result: ReturnType<typeof renderVaultWithdrawFlow>['result'],
  input: BeginVaultWithdrawReviewInput = { plpAmountAtomic: plpAmount },
) {
  let outcome: Awaited<ReturnType<typeof result.current.beginWithdrawReview>> | undefined;

  await act(async () => {
    outcome = await result.current.beginWithdrawReview(input);
  });

  if (outcome === undefined) {
    throw new Error('Withdraw review did not return an outcome.');
  }

  return outcome;
}

function createVault(overrides: Partial<VaultModel> = {}): VaultModel {
  return {
    assetBalanceQuote: 1_015_751_903_194n,
    availableLiquidityQuote: 1_013_621_323_890n,
    availableWithdrawalQuote: 1_013_621_323_890n,
    lastRefreshedAtMs: 1_781_635_255_000n,
    maxPayoutUtilizationRatio: 0.0020975390715985472,
    netDepositsQuote: 1_013_136_152_701n,
    plpSharePrice: 1.0018485537482182,
    plpTotalSupplyAtomic: 1_013_114_841_700n,
    predictId: predictDeploymentConfig.predictObjectId,
    quoteAssetType: predictDeploymentConfig.quoteAsset.type,
    quoteAssetTypes: [predictDeploymentConfig.quoteAsset.type],
    totalMaxPayoutQuote: 2_130_579_304n,
    totalMtmQuote: 764_264_256n,
    totalSuppliedQuote: 1_072_609_144_409n,
    totalWithdrawnQuote: 59_472_991_708n,
    utilizationRatio: 0.0007524123298187235,
    vaultBalanceQuote: 1_015_751_903_194n,
    vaultValueQuote: 1_014_987_638_938n,
    ...overrides,
  };
}
