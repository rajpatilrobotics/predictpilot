import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  predictProtocolTypes,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';
import { buildSupplyVaultTx } from '@/integrations/deepbook-predict/tx/supply-vault';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel } from '@/types/vault';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const amountQuote = 1_500_000n as QuoteAmount;
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

describe('buildSupplyVaultTx', () => {
  it('builds a DUSDC coin intent, predicts supply, and transfers returned PLP', () => {
    const result = buildSupplyVaultTx({ amountQuote, sender, vault: createVault() });

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
            balance: amountQuote,
            outputKind: 'coin',
            type: predictProtocolTypes.quoteAssetType,
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
          function: 'supply',
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

    const supplyCommand = transactionData.commands[1];
    const moveCall = supplyCommand?.MoveCall;
    const target = `${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`;

    expect(target).toBe(predictTxTargets.predict.supply);
  });

  it('returns a preview and execution request for later signing', () => {
    const vault = createVault();
    const result = buildSupplyVaultTx({ amountQuote, sender, vault });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'SUPPLY',
      affectedObjects: [
        {
          id: predictDeploymentConfig.predictObjectId,
          kind: 'predict',
          label: 'Predict vault',
        },
        {
          kind: 'wallet-coin',
          label: 'Wallet DUSDC',
        },
        {
          kind: 'plp-coin',
          label: 'Wallet PLP',
        },
      ],
      amountQuote,
      description: 'Supply wallet DUSDC to the Predict vault and receive PLP shares in the connected wallet.',
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: 'testnet',
      plpConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        coinType: predictProtocolTypes.plpType,
        direction: 'MINT_PLP',
      },
      predictId: predictDeploymentConfig.predictObjectId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender,
      target: predictTxTargets.predict.supply,
      title: 'Supply DUSDC to Predict vault',
      vaultSnapshot: {
        availableLiquidityQuote: vault.availableLiquidityQuote,
        plpSharePrice: vault.plpSharePrice,
        vaultValueQuote: vault.vaultValueQuote,
      },
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'SUPPLY',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely for missing sender, missing config, and missing vault state', () => {
    const missingSender = buildSupplyVaultTx({ amountQuote, vault: createVault() });
    const missingConfig = buildSupplyVaultTx({
      amountQuote,
      protocolConfig: {
        plpType: predictProtocolTypes.plpType,
        quoteAsset: predictDeploymentConfig.quoteAsset,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
        supplyTarget: predictTxTargets.predict.supply,
      },
      sender,
      vault: createVault(),
    });
    const missingVault = buildSupplyVaultTx({ amountQuote, sender });

    expect(missingSender).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'SUPPLY',
          builder: 'buildSupplyVaultTx',
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
  });

  it('fails safely for invalid amounts and incompatible vault quote assets', () => {
    const zeroAmount = buildSupplyVaultTx({ amountQuote: 0n, sender, vault: createVault() });
    const negativeAmount = buildSupplyVaultTx({
      amountQuote: -1n,
      sender,
      vault: createVault(),
    });
    const incompatibleQuote = buildSupplyVaultTx({
      amountQuote,
      sender,
      vault: createVault({
        quoteAssetType: otherQuoteType,
        quoteAssetTypes: [otherQuoteType],
      }),
    });

    expect(zeroAmount).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'amountQuote',
        },
      },
      ok: false,
    });
    expect(negativeAmount).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'amountQuote',
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
