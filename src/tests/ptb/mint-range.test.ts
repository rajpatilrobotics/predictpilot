import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  predictProtocolTypes,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';
import { buildMintRangeTx } from '@/integrations/deepbook-predict/tx/mint-range';
import type { ObjectId, QuoteAmount, RangeKeyModel, SuiAddress } from '@/types/predict';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId =
  '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const quantityQuote = 100_000n as QuoteAmount;
const rangeKey = {
  expiryMs: 200_000n,
  higherStrike1e9: 66_000_000_000_000n,
  lowerStrike1e9: 64_000_000_000_000n,
  oracleId,
} satisfies RangeKeyModel;

describe('buildMintRangeTx', () => {
  it('builds RangeKey first, then predict mint_range with DUSDC and clock', () => {
    const result = buildMintRangeTx({ managerId, quantityQuote, rangeKey, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData.inputs).toMatchObject([
      { $kind: 'Pure' },
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
            { $kind: 'Input', Input: 3, type: 'pure' },
          ],
          function: 'new',
          module: 'range_key',
          package: predictDeploymentConfig.packageId,
          typeArguments: [],
        },
      },
      {
        $kind: 'MoveCall',
        MoveCall: {
          arguments: [
            { $kind: 'Input', Input: 4, type: 'object' },
            { $kind: 'Input', Input: 5, type: 'object' },
            { $kind: 'Input', Input: 6, type: 'object' },
            { $kind: 'Result', Result: 0 },
            { $kind: 'Input', Input: 7, type: 'pure' },
            { $kind: 'Input', Input: 8, type: 'object' },
          ],
          function: 'mint_range',
          module: 'predict',
          package: predictDeploymentConfig.packageId,
          typeArguments: [predictProtocolTypes.quoteAssetType],
        },
      },
    ]);

    const rangeKeyCommand = transactionData.commands[0];
    const rangeKeyMoveCall = rangeKeyCommand?.MoveCall;
    const rangeKeyTarget = `${rangeKeyMoveCall?.package}::${rangeKeyMoveCall?.module}::${rangeKeyMoveCall?.function}`;
    const mintCommand = transactionData.commands[1];
    const mintMoveCall = mintCommand?.MoveCall;
    const mintTarget = `${mintMoveCall?.package}::${mintMoveCall?.module}::${mintMoveCall?.function}`;

    expect(rangeKeyTarget).toBe(predictTxTargets.rangeKey.new);
    expect(mintTarget).toBe(predictTxTargets.predict.mintRange);
  });

  it('returns a preview and execution request for later signing', () => {
    const result = buildMintRangeTx({ managerId, quantityQuote, rangeKey, sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toMatchObject({
      action: 'MINT_RANGE',
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
      description: 'Mint a range position from the selected PredictManager balance.',
      expectedNetwork: 'testnet',
      managerId,
      oracleId,
      quantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey,
      sender,
      target: predictTxTargets.predict.mintRange,
      title: 'Mint range position',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'MINT_RANGE',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildMintRangeTx({ managerId, quantityQuote, rangeKey });

    expect(result).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'MINT_RANGE',
          builder: 'buildMintRangeTx',
        },
      },
      ok: false,
    });
  });

  it('fails safely for invalid object IDs and range fields', () => {
    const invalidManager = buildMintRangeTx({
      managerId: '0xnot-a-manager',
      quantityQuote,
      rangeKey,
      sender,
    });
    const invalidOracle = buildMintRangeTx({
      managerId,
      quantityQuote,
      rangeKey: {
        ...rangeKey,
        oracleId: '0xnot-an-oracle',
      },
      sender,
    });
    const invalidExpiry = buildMintRangeTx({
      managerId,
      quantityQuote,
      rangeKey: {
        ...rangeKey,
        expiryMs: -1n,
      },
      sender,
    });
    const invalidLowerStrike = buildMintRangeTx({
      managerId,
      quantityQuote,
      rangeKey: {
        ...rangeKey,
        lowerStrike1e9: -1n,
      },
      sender,
    });
    const invalidRangeOrder = buildMintRangeTx({
      managerId,
      quantityQuote,
      rangeKey: {
        ...rangeKey,
        lowerStrike1e9: rangeKey.higherStrike1e9,
      },
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
    expect(invalidExpiry).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'expiryMs',
        },
      },
      ok: false,
    });
    expect(invalidLowerStrike).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'lowerStrike1e9',
        },
      },
      ok: false,
    });
    expect(invalidRangeOrder).toMatchObject({
      error: {
        code: 'INVALID_RANGE',
        context: {
          field: 'lowerStrike1e9',
        },
      },
      ok: false,
    });
  });

  it('fails safely when quantity is zero or negative', () => {
    const zeroResult = buildMintRangeTx({ managerId, quantityQuote: 0n, rangeKey, sender });
    const negativeResult = buildMintRangeTx({
      managerId,
      quantityQuote: -1n,
      rangeKey,
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
