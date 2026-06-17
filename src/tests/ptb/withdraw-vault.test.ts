import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  predictProtocolTypes,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';
import { buildWithdrawVaultTx } from '@/integrations/deepbook-predict/tx/withdraw-vault';
import type { SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const plpAmountAtomic = 1_500_000n;
const walletPlpBalanceAtomic = 2_000_000n;
const otherQuoteType = '0x2::other::COIN';

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

describe('buildWithdrawVaultTx', () => {
  it('builds a PLP coin intent, predicts withdraw, and transfers returned DUSDC', () => {
    const result = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData.inputs).toMatchObject([
      {
        $kind: 'UnresolvedObject',
        UnresolvedObject: {
          objectId: predictDeploymentConfig.predictObjectId,
        },
      },
      {
        $kind: 'Object',
        Object: {
          SharedObject: {
            initialSharedVersion: 1,
            mutable: false,
            objectId: '0x0000000000000000000000000000000000000000000000000000000000000006',
          },
        },
      },
      { $kind: 'Pure' },
    ]);
    expect(transactionData.commands).toMatchObject([
      {
        $Intent: {
          data: {
            balance: plpAmountAtomic,
            outputKind: 'coin',
            type: predictProtocolTypes.plpType,
          },
          name: 'CoinWithBalance',
        },
        $kind: '$Intent',
      },
      {
        $kind: 'MoveCall',
        MoveCall: {
          arguments: [
            { $kind: 'Input', Input: 0, type: 'object' },
            { $kind: 'Result', Result: 0 },
            { $kind: 'Input', Input: 1, type: 'object' },
          ],
          function: 'withdraw',
          module: 'predict',
          package: predictDeploymentConfig.packageId,
          typeArguments: [predictProtocolTypes.quoteAssetType],
        },
      },
      {
        $kind: 'TransferObjects',
        TransferObjects: {
          address: { $kind: 'Input', Input: 2, type: 'pure' },
          objects: [{ $kind: 'Result', Result: 1 }],
        },
      },
    ]);

    const withdrawCommand = transactionData.commands[1];
    const moveCall = withdrawCommand?.MoveCall;
    const target = `${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`;

    expect(target).toBe(predictTxTargets.predict.withdraw);
  });

  it('returns a preview and execution request for later signing', () => {
    const vault = createVault();
    const result = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault,
      walletPlpBalanceAtomic,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'WITHDRAW',
      affectedObjects: [
        {
          id: predictDeploymentConfig.predictObjectId,
          kind: 'predict',
          label: 'Predict vault',
        },
        {
          kind: 'plp-coin',
          label: 'Wallet PLP',
        },
        {
          kind: 'wallet-coin',
          label: 'Wallet DUSDC',
        },
      ],
      description: 'Burn wallet PLP shares through the Predict vault and receive DUSDC in the connected wallet.',
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: 'testnet',
      plpAmountAtomic,
      plpBurnConsequence: {
        amountAtomic: plpAmountAtomic,
        coinType: predictProtocolTypes.plpType,
        direction: 'BURN_PLP',
      },
      predictId: predictDeploymentConfig.predictObjectId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      quoteConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        coinType: predictProtocolTypes.quoteAssetType,
        direction: 'RETURN_QUOTE',
      },
      sender,
      target: predictTxTargets.predict.withdraw,
      title: 'Withdraw DUSDC from Predict vault',
      vaultSnapshot: {
        availableWithdrawalQuote: vault.availableWithdrawalQuote,
        maxPayoutUtilizationRatio: vault.maxPayoutUtilizationRatio,
        vaultValueQuote: vault.vaultValueQuote,
      },
      walletPlpBalanceAtomic,
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'WITHDRAW',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely for missing sender, missing config, missing vault, and missing PLP balance', () => {
    const missingSender = buildWithdrawVaultTx({
      plpAmountAtomic,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });
    const missingConfig = buildWithdrawVaultTx({
      plpAmountAtomic,
      protocolConfig: {
        plpType: predictProtocolTypes.plpType,
        quoteAsset: predictDeploymentConfig.quoteAsset,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
        withdrawTarget: predictTxTargets.predict.withdraw,
      },
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });
    const missingVault = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      walletPlpBalanceAtomic,
    });
    const missingPlpBalance = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault: createVault(),
    });

    expect(missingSender).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'WITHDRAW',
          builder: 'buildWithdrawVaultTx',
        },
      },
      ok: false,
    });
    expect(missingConfig).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
        context: {
          field: 'predictObjectId',
        },
      },
      ok: false,
    });
    expect(missingVault).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
        context: {
          field: 'vault',
        },
      },
      ok: false,
    });
    expect(missingPlpBalance).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
        context: {
          field: 'walletPlpBalanceAtomic',
        },
      },
      ok: false,
    });
  });

  it('fails safely for invalid amounts, insufficient PLP, unavailable withdrawal, and incompatible quote assets', () => {
    const zeroAmount = buildWithdrawVaultTx({
      plpAmountAtomic: 0n,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });
    const negativeAmount = buildWithdrawVaultTx({
      plpAmountAtomic: -1n,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic,
    });
    const insufficientPlp = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault: createVault(),
      walletPlpBalanceAtomic: 1n,
    });
    const unavailableWithdrawal = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault: createVault({ availableWithdrawalQuote: 0n }),
      walletPlpBalanceAtomic,
    });
    const incompatibleQuote = buildWithdrawVaultTx({
      plpAmountAtomic,
      sender,
      vault: createVault({
        quoteAssetType: otherQuoteType,
        quoteAssetTypes: [otherQuoteType],
      }),
      walletPlpBalanceAtomic,
    });

    expect(zeroAmount).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'plpAmountAtomic',
        },
      },
      ok: false,
    });
    expect(negativeAmount).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'plpAmountAtomic',
        },
      },
      ok: false,
    });
    expect(insufficientPlp).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'walletPlpBalanceAtomic',
        },
      },
      ok: false,
    });
    expect(unavailableWithdrawal).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'availableWithdrawalQuote',
        },
      },
      ok: false,
    });
    expect(incompatibleQuote).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quoteAssetType',
        },
      },
      ok: false,
    });
  });
});
