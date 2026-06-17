import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes, predictTxTargets } from '@/integrations/deepbook-predict/targets';
import { buildSupplyVaultTx } from '@/integrations/deepbook-predict/tx/supply-vault';
import {
  createVaultFixture,
  expectPtbError,
  expectPtbOk,
  expectVaultFlowTransaction,
  expectWalletDisconnected,
  ptbSender,
  ptbVaultAmountQuote,
} from './ptb-test-helpers';

const otherQuoteType = '0x2::other::COIN';

describe('buildSupplyVaultTx', () => {
  it('builds a DUSDC coin intent, predicts supply, and transfers returned PLP', () => {
    const result = expectPtbOk(
      buildSupplyVaultTx({
        amountQuote: ptbVaultAmountQuote,
        sender: ptbSender,
        vault: createVaultFixture(),
      }),
    );

    expectVaultFlowTransaction({
      coinAmount: ptbVaultAmountQuote,
      coinType: predictProtocolTypes.quoteAssetType,
      data: result.transaction.getData(),
      functionName: 'supply',
      target: predictTxTargets.predict.supply,
    });
  });

  it('returns a preview and execution request for later signing', () => {
    const vault = createVaultFixture();
    const result = expectPtbOk(
      buildSupplyVaultTx({ amountQuote: ptbVaultAmountQuote, sender: ptbSender, vault }),
    );

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
      amountQuote: ptbVaultAmountQuote,
      description:
        'Supply wallet DUSDC to the Predict vault and receive PLP shares in the connected wallet.',
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: 'testnet',
      plpConsequence: {
        amountStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
        coinType: predictProtocolTypes.plpType,
        direction: 'MINT_PLP',
      },
      predictId: predictDeploymentConfig.predictObjectId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender: ptbSender,
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
      sender: ptbSender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely for missing sender, missing config, and missing vault state', () => {
    const missingSender = buildSupplyVaultTx({
      amountQuote: ptbVaultAmountQuote,
      vault: createVaultFixture(),
    });
    const missingConfig = buildSupplyVaultTx({
      amountQuote: ptbVaultAmountQuote,
      protocolConfig: {
        plpType: predictProtocolTypes.plpType,
        quoteAsset: predictDeploymentConfig.quoteAsset,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
        supplyTarget: predictTxTargets.predict.supply,
      },
      sender: ptbSender,
      vault: createVaultFixture(),
    });
    const missingVault = buildSupplyVaultTx({
      amountQuote: ptbVaultAmountQuote,
      sender: ptbSender,
    });

    expectWalletDisconnected(missingSender, {
      action: 'SUPPLY',
      builder: 'buildSupplyVaultTx',
    });
    expectPtbError(missingConfig, { code: 'TODO_VERIFY_PATH_USED', field: 'predictObjectId' });
    expectPtbError(missingVault, { code: 'TODO_VERIFY_PATH_USED', field: 'vault' });
  });

  it('fails safely for invalid amounts and incompatible vault quote assets', () => {
    const zeroAmount = buildSupplyVaultTx({
      amountQuote: 0n,
      sender: ptbSender,
      vault: createVaultFixture(),
    });
    const negativeAmount = buildSupplyVaultTx({
      amountQuote: -1n,
      sender: ptbSender,
      vault: createVaultFixture(),
    });
    const incompatibleQuote = buildSupplyVaultTx({
      amountQuote: ptbVaultAmountQuote,
      sender: ptbSender,
      vault: createVaultFixture({
        quoteAssetType: otherQuoteType,
        quoteAssetTypes: [otherQuoteType],
      }),
    });

    expectPtbError(zeroAmount, { code: 'INVALID_INPUT', field: 'amountQuote' });
    expectPtbError(negativeAmount, { code: 'INVALID_INPUT', field: 'amountQuote' });
    expectPtbError(incompatibleQuote, { code: 'INVALID_INPUT', field: 'quoteAssetType' });
  });
});
