import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  predictProtocolTypes,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';
import { buildRedeemBinaryTx } from '@/integrations/deepbook-predict/tx/redeem-binary';
import type { MarketKeyModel, ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId =
  '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const quantityQuote = 100_000n as QuoteAmount;
const marketKey = {
  direction: 'UP',
  expiryMs: 200_000n,
  oracleId,
  strike1e9: 65_000_000_000_000n,
} satisfies MarketKeyModel;

describe('buildRedeemBinaryTx', () => {
  it('builds MarketKey first, then predict redeem with DUSDC and clock', () => {
    const result = buildRedeemBinaryTx({ managerId, marketKey, quantityQuote, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData.inputs).toMatchObject([
      { $kind: 'Pure' },
      { $kind: 'Pure' },
      { $kind: 'Pure' },
      {
        $kind: 'UnresolvedObject',
        UnresolvedObject: {
          objectId: predictDeploymentConfig.predictObjectId,
        },
      },
      {
        $kind: 'UnresolvedObject',
        UnresolvedObject: {
          objectId: managerId,
        },
      },
      {
        $kind: 'UnresolvedObject',
        UnresolvedObject: {
          objectId: oracleId,
        },
      },
      { $kind: 'Pure' },
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
    ]);
    expect(transactionData.commands).toMatchObject([
      {
        $kind: 'MoveCall',
        MoveCall: {
          arguments: [
            { $kind: 'Input', Input: 0, type: 'pure' },
            { $kind: 'Input', Input: 1, type: 'pure' },
            { $kind: 'Input', Input: 2, type: 'pure' },
          ],
          function: 'up',
          module: 'market_key',
          package: predictDeploymentConfig.packageId,
          typeArguments: [],
        },
      },
      {
        $kind: 'MoveCall',
        MoveCall: {
          arguments: [
            { $kind: 'Input', Input: 3, type: 'object' },
            { $kind: 'Input', Input: 4, type: 'object' },
            { $kind: 'Input', Input: 5, type: 'object' },
            { $kind: 'Result', Result: 0 },
            { $kind: 'Input', Input: 6, type: 'pure' },
            { $kind: 'Input', Input: 7, type: 'object' },
          ],
          function: 'redeem',
          module: 'predict',
          package: predictDeploymentConfig.packageId,
          typeArguments: [predictProtocolTypes.quoteAssetType],
        },
      },
    ]);

    const marketKeyCommand = transactionData.commands[0];
    const marketKeyMoveCall = marketKeyCommand?.MoveCall;
    const marketKeyTarget = `${marketKeyMoveCall?.package}::${marketKeyMoveCall?.module}::${marketKeyMoveCall?.function}`;
    const redeemCommand = transactionData.commands[1];
    const redeemMoveCall = redeemCommand?.MoveCall;
    const redeemTarget = `${redeemMoveCall?.package}::${redeemMoveCall?.module}::${redeemMoveCall?.function}`;

    expect(marketKeyTarget).toBe(predictTxTargets.marketKey.up);
    expect(redeemTarget).toBe(predictTxTargets.predict.redeem);
  });

  it('uses the down MarketKey target for DOWN direction', () => {
    const result = buildRedeemBinaryTx({
      managerId,
      marketKey: {
        ...marketKey,
        direction: 'DOWN',
      },
      quantityQuote,
      sender,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const [marketKeyCommand] = result.transaction.getData().commands;
    const marketKeyMoveCall = marketKeyCommand?.MoveCall;
    const marketKeyTarget = `${marketKeyMoveCall?.package}::${marketKeyMoveCall?.module}::${marketKeyMoveCall?.function}`;

    expect(marketKeyTarget).toBe(predictTxTargets.marketKey.down);
  });

  it('returns a preview and execution request for later signing', () => {
    const result = buildRedeemBinaryTx({ managerId, marketKey, quantityQuote, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'REDEEM',
      affectedObjects: [
        {
          id: predictDeploymentConfig.predictObjectId,
          kind: 'predict',
          label: 'Predict',
        },
        {
          id: managerId,
          kind: 'manager',
          label: 'PredictManager',
        },
        {
          id: oracleId,
          kind: 'oracle',
          label: 'OracleSVI',
        },
      ],
      description: 'Redeem a binary position back into the selected PredictManager balance.',
      direction: 'UP',
      expectedNetwork: 'testnet',
      managerId,
      marketKey,
      oracleId,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender,
      target: predictTxTargets.predict.redeem,
      title: 'Redeem binary position',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'REDEEM',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildRedeemBinaryTx({ managerId, marketKey, quantityQuote });

    expect(result).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'REDEEM',
          builder: 'buildRedeemBinaryTx',
        },
      },
      ok: false,
    });
  });

  it('fails safely for invalid object IDs and market key fields', () => {
    const invalidManager = buildRedeemBinaryTx({
      managerId: '0xnot-a-manager',
      marketKey,
      quantityQuote,
      sender,
    });
    const invalidOracle = buildRedeemBinaryTx({
      managerId,
      marketKey: {
        ...marketKey,
        oracleId: '0xnot-an-oracle',
      },
      quantityQuote,
      sender,
    });
    const invalidDirection = buildRedeemBinaryTx({
      managerId,
      marketKey: {
        ...marketKey,
        direction: 'SIDEWAYS',
      } as unknown as MarketKeyModel,
      quantityQuote,
      sender,
    });
    const invalidExpiry = buildRedeemBinaryTx({
      managerId,
      marketKey: {
        ...marketKey,
        expiryMs: -1n,
      },
      quantityQuote,
      sender,
    });

    expect(invalidManager).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'managerId',
        },
      },
      ok: false,
    });
    expect(invalidOracle).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'oracleId',
        },
      },
      ok: false,
    });
    expect(invalidDirection).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'direction',
        },
      },
      ok: false,
    });
    expect(invalidExpiry).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'expiryMs',
        },
      },
      ok: false,
    });
  });

  it('fails safely when quantity is zero or negative', () => {
    const zeroResult = buildRedeemBinaryTx({ managerId, marketKey, quantityQuote: 0n, sender });
    const negativeResult = buildRedeemBinaryTx({
      managerId,
      marketKey,
      quantityQuote: -1n,
      sender,
    });

    expect(zeroResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quantityQuote',
        },
      },
      ok: false,
    });
    expect(negativeResult).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'quantityQuote',
        },
      },
      ok: false,
    });
  });
});
