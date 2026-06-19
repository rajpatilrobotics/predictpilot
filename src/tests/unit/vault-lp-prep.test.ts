import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes } from '@/integrations/deepbook-predict/targets';
import { prepareVaultSupply, prepareVaultWithdraw } from '@/features/vault/lib/vault-lp-prep';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const amountQuote = 1_500_000n as QuoteAmount;
const walletDusdcBalanceQuote = 2_000_000n as QuoteAmount;
const plpAmountAtomic = 1_500_000n;
const walletPlpBalanceAtomic = 2_000_000n;

function createVault(overrides: Partial<VaultModel> = {}): VaultModel {
  return {
    assetBalanceQuote: 5_000_000n,
    availableLiquidityQuote: 4_000_000n,
    availableWithdrawalQuote: 3_000_000n,
    lastRefreshedAtMs: 100_000n,
    maxPayoutUtilizationRatio: 0.25,
    netDepositsQuote: 5_000_000n,
    plpSharePrice: 1.02,
    plpTotalSupplyAtomic: 5_000_000n,
    predictId: predictDeploymentConfig.predictObjectId,
    quoteAssetType: predictProtocolTypes.quoteAssetType,
    quoteAssetTypes: [predictProtocolTypes.quoteAssetType],
    totalMaxPayoutQuote: 1_000_000n,
    totalMtmQuote: 50_000n,
    totalSuppliedQuote: 6_000_000n,
    totalWithdrawnQuote: 1_000_000n,
    utilizationRatio: 0.2,
    vaultBalanceQuote: 5_000_000n,
    vaultValueQuote: 5_100_000n,
    ...overrides,
  };
}

function createSimulationTransport(result: unknown): PredictSimulationTransport {
  return {
    simulateTransaction: vi.fn().mockResolvedValue(result),
  };
}

function successfulSimulationResult() {
  return {
    $kind: 'Transaction',
    Transaction: {
      balanceChanges: [{ amount: '1' }],
      digest: 'simulated-digest',
      effects: {
        status: {
          status: 'success',
        },
      },
    },
    commandResults: [{ returnValues: [] }],
  };
}

function failedSimulationResult() {
  return {
    $kind: 'FailedTransaction',
    FailedTransaction: {
      digest: 'failed-digest',
      effects: {
        status: {
          error: 'Insufficient vault liquidity',
          status: 'failure',
        },
      },
    },
  };
}

describe('vault LP preparation', () => {
  it('prepares vault supply with a builder preview and execution request', async () => {
    const result = await prepareVaultSupply({
      amountQuote,
      sender,
      vault: createVault(),
      walletDusdcBalanceQuote,
    });

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'SUPPLY',
      amountQuote,
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      plpConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        direction: 'MINT_PLP',
      },
      sender,
    });
    expect(result.executionRequest).toMatchObject({
      action: 'SUPPLY',
      sender,
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.warnings).toContain(
      'Exact PLP shares out require simulation or confirmed onchain execution.',
    );
  });

  it('blocks vault supply before building when wallet DUSDC is insufficient', async () => {
    const result = await prepareVaultSupply({
      amountQuote,
      sender,
      vault: createVault(),
      walletDusdcBalanceQuote: 1n,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INSUFFICIENT_WALLET_DUSDC',
        context: {
          action: 'SUPPLY',
          availableQuote: '1',
          requestedQuote: amountQuote.toString(),
        },
      },
      status: 'blocked',
    });
  });

  it('returns simulation-ready supply when an injected transport succeeds', async () => {
    const transport = createSimulationTransport(successfulSimulationResult());
    const result = await prepareVaultSupply({
      amountQuote,
      sender,
      simulation: {
        enabled: true,
        transport,
      },
      vault: createVault(),
      walletDusdcBalanceQuote,
    });

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error(result.error.message);
    }

    expect(transport.simulateTransaction).toHaveBeenCalledOnce();
    expect(result.simulationPreview).toMatchObject({
      simulation: {
        digest: 'simulated-digest',
        effectsStatus: 'success',
      },
      status: 'ready',
    });
  });

  it('returns simulation-blocked supply when simulation fails', async () => {
    const result = await prepareVaultSupply({
      amountQuote,
      sender,
      simulation: {
        enabled: true,
        transport: createSimulationTransport(failedSimulationResult()),
      },
      vault: createVault(),
      walletDusdcBalanceQuote,
    });

    expect(result).toMatchObject({
      error: {
        code: 'SIMULATION_FAILED',
      },
      simulationPreview: {
        status: 'blocked',
      },
      status: 'simulation-blocked',
    });
  });

  it('prepares vault withdraw with PLP burn and quote return consequences', async () => {
    const result = await prepareVaultWithdraw({
      plpAmountAtomic,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'WITHDRAW',
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      plpAmountAtomic,
      plpBurnConsequence: {
        amountAtomic: plpAmountAtomic,
        direction: 'BURN_PLP',
      },
      quoteConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        direction: 'RETURN_QUOTE',
      },
      sender,
    });
    expect(result.executionRequest).toMatchObject({
      action: 'WITHDRAW',
      sender,
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
  });

  it('blocks vault withdraw when wallet PLP is insufficient', async () => {
    const result = await prepareVaultWithdraw({
      plpAmountAtomic,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic: 1n,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'walletPlpBalanceAtomic',
        },
      },
      status: 'blocked',
    });
  });

  it('blocks vault withdraw when vault withdrawal is unavailable', async () => {
    const result = await prepareVaultWithdraw({
      plpAmountAtomic,
      sender,
      vault: createVault({ availableWithdrawalQuote: 0n }),
      walletPlpBalanceAtomic,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'availableWithdrawalQuote',
        },
      },
      status: 'blocked',
    });
  });
});
