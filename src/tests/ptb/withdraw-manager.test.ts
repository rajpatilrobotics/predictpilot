import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { buildWithdrawFromManagerTx } from '@/integrations/deepbook-predict/tx/withdraw-manager';
import { predictProtocolTypes, predictTxTargets } from '@/integrations/deepbook-predict/targets';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const amountQuote = 1_500_000n as QuoteAmount;

describe('buildWithdrawFromManagerTx', () => {
  it('builds a manager withdraw Move call and transfers the returned DUSDC coin', () => {
    const result = buildWithdrawFromManagerTx({ amountQuote, managerId, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData.inputs).toHaveLength(3);
    expect(transactionData.inputs[0]).toMatchObject({
      $kind: 'UnresolvedObject',
      UnresolvedObject: {
        objectId: managerId,
      },
    });
    expect(transactionData.inputs[1]).toMatchObject({
      $kind: 'Pure',
    });
    expect(transactionData.inputs[2]).toMatchObject({
      $kind: 'Pure',
    });
    expect(transactionData.commands).toMatchObject([
      {
        $kind: 'MoveCall',
        MoveCall: {
          arguments: [
            { $kind: 'Input', Input: 0, type: 'object' },
            { $kind: 'Input', Input: 1, type: 'pure' },
          ],
          function: 'withdraw',
          module: 'predict_manager',
          package: predictDeploymentConfig.packageId,
          typeArguments: [predictProtocolTypes.quoteAssetType],
        },
      },
      {
        $kind: 'TransferObjects',
        TransferObjects: {
          address: { $kind: 'Input', Input: 2, type: 'pure' },
          objects: [{ $kind: 'Result', Result: 0 }],
        },
      },
    ]);

    const withdrawCommand = transactionData.commands[0];
    const moveCall = withdrawCommand?.MoveCall;
    const target = `${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`;

    expect(target).toBe(predictTxTargets.predictManager.withdraw);
  });

  it('returns a preview and execution request for later signing', () => {
    const result = buildWithdrawFromManagerTx({ amountQuote, managerId, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toEqual({
      action: 'WITHDRAW_QUOTE',
      affectedObjects: [
        {
          id: managerId,
          kind: 'manager',
          label: 'PredictManager',
        },
        {
          kind: 'wallet-coin',
          label: 'Wallet DUSDC',
        },
      ],
      amountQuote,
      description: 'Withdraw manager DUSDC back to the connected wallet.',
      expectedNetwork: 'testnet',
      managerId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender,
      target: predictTxTargets.predictManager.withdraw,
      title: 'Withdraw DUSDC from PredictManager',
    });
    expect(result.executionRequest).toMatchObject({
      action: 'WITHDRAW_QUOTE',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildWithdrawFromManagerTx({ amountQuote, managerId });

    expect(result).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'WITHDRAW_QUOTE',
          builder: 'buildWithdrawFromManagerTx',
        },
      },
      ok: false,
    });
  });

  it('fails safely when manager ID is invalid', () => {
    const result = buildWithdrawFromManagerTx({
      amountQuote,
      managerId: '0xnot-a-manager',
      sender,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'WITHDRAW_QUOTE',
          builder: 'buildWithdrawFromManagerTx',
          field: 'managerId',
        },
      },
      ok: false,
    });
  });

  it('fails safely when amount is zero or negative', () => {
    const zeroResult = buildWithdrawFromManagerTx({ amountQuote: 0n, managerId, sender });
    const negativeResult = buildWithdrawFromManagerTx({
      amountQuote: -1n,
      managerId,
      sender,
    });

    expect(zeroResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'WITHDRAW_QUOTE',
          builder: 'buildWithdrawFromManagerTx',
          field: 'amountQuote',
        },
      },
      ok: false,
    });
    expect(negativeResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'WITHDRAW_QUOTE',
          builder: 'buildWithdrawFromManagerTx',
          field: 'amountQuote',
        },
      },
      ok: false,
    });
  });
});
