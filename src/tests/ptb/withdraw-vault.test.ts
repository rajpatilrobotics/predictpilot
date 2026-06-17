import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes, predictTxTargets } from '@/integrations/deepbook-predict/targets';
import { buildWithdrawVaultTx } from '@/integrations/deepbook-predict/tx/withdraw-vault';
import {
  createVaultFixture,
  expectPtbError,
  expectPtbOk,
  expectVaultFlowTransaction,
  expectWalletDisconnected,
  ptbPlpAmountAtomic,
  ptbSender,
  ptbWalletPlpBalanceAtomic,
} from './ptb-test-helpers';

const otherQuoteType = '0x2::other::COIN';

describe('buildWithdrawVaultTx', () => {
  it('builds a PLP coin intent, predicts withdraw, and transfers returned DUSDC', () => {
    const result = expectPtbOk(
      buildWithdrawVaultTx({
        plpAmountAtomic: ptbPlpAmountAtomic,
        sender: ptbSender,
        vault: createVaultFixture(),
        walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
      }),
    );

    expectVaultFlowTransaction({
      coinAmount: ptbPlpAmountAtomic,
      coinType: predictProtocolTypes.plpType,
      data: result.transaction.getData(),
      functionName: 'withdraw',
      target: predictTxTargets.predict.withdraw,
    });
  });

  it('returns a preview and execution request for later signing', () => {
    const vault = createVaultFixture();
    const result = expectPtbOk(
      buildWithdrawVaultTx({
        plpAmountAtomic: ptbPlpAmountAtomic,
        sender: ptbSender,
        vault,
        walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
      }),
    );

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
      description:
        'Burn wallet PLP shares through the Predict vault and receive DUSDC in the connected wallet.',
      exactOutputStatus: 'SIMULATION_OR_CONFIRMATION_REQUIRED',
      expectedNetwork: 'testnet',
      plpAmountAtomic: ptbPlpAmountAtomic,
      plpBurnConsequence: {
        amountAtomic: ptbPlpAmountAtomic,
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
      sender: ptbSender,
      target: predictTxTargets.predict.withdraw,
      title: 'Withdraw DUSDC from Predict vault',
      vaultSnapshot: {
        availableWithdrawalQuote: vault.availableWithdrawalQuote,
        maxPayoutUtilizationRatio: vault.maxPayoutUtilizationRatio,
        vaultValueQuote: vault.vaultValueQuote,
      },
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'WITHDRAW',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender: ptbSender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely for missing sender, missing config, missing vault, and missing PLP balance', () => {
    const missingSender = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      vault: createVaultFixture(),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const missingConfig = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      protocolConfig: {
        plpType: predictProtocolTypes.plpType,
        quoteAsset: predictDeploymentConfig.quoteAsset,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
        withdrawTarget: predictTxTargets.predict.withdraw,
      },
      sender: ptbSender,
      vault: createVaultFixture(),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const missingVault = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      sender: ptbSender,
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const missingPlpBalance = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      sender: ptbSender,
      vault: createVaultFixture(),
    });

    expectWalletDisconnected(missingSender, {
      action: 'WITHDRAW',
      builder: 'buildWithdrawVaultTx',
    });
    expectPtbError(missingConfig, { code: 'TODO_VERIFY_PATH_USED', field: 'predictObjectId' });
    expectPtbError(missingVault, { code: 'TODO_VERIFY_PATH_USED', field: 'vault' });
    expectPtbError(missingPlpBalance, {
      code: 'TODO_VERIFY_PATH_USED',
      field: 'walletPlpBalanceAtomic',
    });
  });

  it('fails safely for invalid amounts, insufficient PLP, unavailable withdrawal, and incompatible quote assets', () => {
    const zeroAmount = buildWithdrawVaultTx({
      plpAmountAtomic: 0n,
      sender: ptbSender,
      vault: createVaultFixture(),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const negativeAmount = buildWithdrawVaultTx({
      plpAmountAtomic: -1n,
      sender: ptbSender,
      vault: createVaultFixture(),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const insufficientPlp = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      sender: ptbSender,
      vault: createVaultFixture(),
      walletPlpBalanceAtomic: 1n,
    });
    const unavailableWithdrawal = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      sender: ptbSender,
      vault: createVaultFixture({ availableWithdrawalQuote: 0n }),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });
    const incompatibleQuote = buildWithdrawVaultTx({
      plpAmountAtomic: ptbPlpAmountAtomic,
      sender: ptbSender,
      vault: createVaultFixture({
        quoteAssetType: otherQuoteType,
        quoteAssetTypes: [otherQuoteType],
      }),
      walletPlpBalanceAtomic: ptbWalletPlpBalanceAtomic,
    });

    expectPtbError(zeroAmount, { code: 'INVALID_INPUT', field: 'plpAmountAtomic' });
    expectPtbError(negativeAmount, { code: 'INVALID_INPUT', field: 'plpAmountAtomic' });
    expectPtbError(insufficientPlp, { code: 'INVALID_INPUT', field: 'walletPlpBalanceAtomic' });
    expectPtbError(unavailableWithdrawal, {
      code: 'INVALID_INPUT',
      field: 'availableWithdrawalQuote',
    });
    expectPtbError(incompatibleQuote, { code: 'INVALID_INPUT', field: 'quoteAssetType' });
  });
});
