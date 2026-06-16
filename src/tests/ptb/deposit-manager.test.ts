import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { buildDepositToManagerTx } from '@/integrations/deepbook-predict/tx/deposit-manager';
import {
  predictProtocolTypes,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const amountQuote = 1_500_000n as QuoteAmount;

describe('buildDepositToManagerTx', () => {
  it('builds a DUSDC coin intent and manager deposit Move call from the target registry', () => {
    const result = buildDepositToManagerTx({ amountQuote, managerId, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData.inputs).toMatchObject([
      {
        $kind: 'UnresolvedObject',
        UnresolvedObject: {
          objectId: managerId,
        },
      },
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
          ],
          function: 'deposit',
          module: 'predict_manager',
          package: predictDeploymentConfig.packageId,
          typeArguments: [predictProtocolTypes.quoteAssetType],
        },
      },
    ]);

    const depositCommand = transactionData.commands[1];
    const moveCall = depositCommand?.MoveCall;
    const target = `${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`;

    expect(target).toBe(predictTxTargets.predictManager.deposit);
  });

  it('returns a preview and execution request for later signing', () => {
    const result = buildDepositToManagerTx({ amountQuote, managerId, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toEqual({
      action: 'DEPOSIT_QUOTE',
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
      description: 'Deposit wallet DUSDC into the selected PredictManager before trading.',
      expectedNetwork: 'testnet',
      managerId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender,
      target: predictTxTargets.predictManager.deposit,
      title: 'Deposit DUSDC to PredictManager',
    });
    expect(result.executionRequest).toMatchObject({
      action: 'DEPOSIT_QUOTE',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildDepositToManagerTx({ amountQuote, managerId });

    expect(result).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'DEPOSIT_QUOTE',
          builder: 'buildDepositToManagerTx',
        },
      },
      ok: false,
    });
  });

  it('fails safely when manager ID is invalid', () => {
    const result = buildDepositToManagerTx({
      amountQuote,
      managerId: '0xnot-a-manager',
      sender,
    });

    expect(result).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'DEPOSIT_QUOTE',
          builder: 'buildDepositToManagerTx',
          field: 'managerId',
        },
      },
      ok: false,
    });
  });

  it('fails safely when amount is zero or negative', () => {
    const zeroResult = buildDepositToManagerTx({ amountQuote: 0n, managerId, sender });
    const negativeResult = buildDepositToManagerTx({
      amountQuote: -1n,
      managerId,
      sender,
    });

    expect(zeroResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'DEPOSIT_QUOTE',
          builder: 'buildDepositToManagerTx',
          field: 'amountQuote',
        },
      },
      ok: false,
    });
    expect(negativeResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          action: 'DEPOSIT_QUOTE',
          builder: 'buildDepositToManagerTx',
          field: 'amountQuote',
        },
      },
      ok: false,
    });
  });
});
