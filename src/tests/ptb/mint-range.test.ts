import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictTxTargets } from '@/integrations/deepbook-predict/targets';
import { buildMintRangeTx } from '@/integrations/deepbook-predict/tx/mint-range';
import {
  expectPtbError,
  expectPtbOk,
  expectRangeTradeTransaction,
  expectWalletDisconnected,
  expectedPredictManagerOracleHints,
  ptbManagerId,
  ptbOracleId,
  ptbQuantityQuote,
  ptbRangeKey,
  ptbSender,
} from './ptb-test-helpers';

describe('buildMintRangeTx', () => {
  it('builds RangeKey first, then predict mint_range with DUSDC and clock', () => {
    const result = expectPtbOk(
      buildMintRangeTx({
        managerId: ptbManagerId,
        quantityQuote: ptbQuantityQuote,
        rangeKey: ptbRangeKey,
        sender: ptbSender,
      }),
    );

    expectRangeTradeTransaction({
      actionFunction: 'mint_range',
      actionTarget: predictTxTargets.predict.mintRange,
      data: result.transaction.getData(),
    });
  });

  it('returns a preview and execution request for later signing', () => {
    const result = expectPtbOk(
      buildMintRangeTx({
        managerId: ptbManagerId,
        quantityQuote: ptbQuantityQuote,
        rangeKey: ptbRangeKey,
        sender: ptbSender,
      }),
    );

    expect(result.preview).toMatchObject({
      action: 'MINT_RANGE',
      affectedObjects: expectedPredictManagerOracleHints(),
      description: 'Mint a range position from the selected PredictManager balance.',
      expectedNetwork: 'testnet',
      managerId: ptbManagerId,
      oracleId: ptbOracleId,
      quantityQuote: ptbQuantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
      target: predictTxTargets.predict.mintRange,
      title: 'Mint range position',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'MINT_RANGE',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender: ptbSender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: ptbRangeKey,
    });

    expectWalletDisconnected(result, {
      action: 'MINT_RANGE',
      builder: 'buildMintRangeTx',
    });
  });

  it('fails safely for invalid object IDs and range fields', () => {
    const invalidManager = buildMintRangeTx({
      managerId: '0xnot-a-manager',
      quantityQuote: ptbQuantityQuote,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });
    const invalidOracle = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        oracleId: '0xnot-an-oracle',
      },
      sender: ptbSender,
    });
    const invalidExpiry = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        expiryMs: -1n,
      },
      sender: ptbSender,
    });
    const invalidLowerStrike = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        lowerStrike1e9: -1n,
      },
      sender: ptbSender,
    });
    const invalidRangeOrder = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        lowerStrike1e9: ptbRangeKey.higherStrike1e9,
      },
      sender: ptbSender,
    });

    expectPtbError(invalidManager, { code: 'INVALID_INPUT', field: 'managerId' });
    expectPtbError(invalidOracle, { code: 'INVALID_INPUT', field: 'oracleId' });
    expectPtbError(invalidExpiry, { code: 'INVALID_INPUT', field: 'expiryMs' });
    expectPtbError(invalidLowerStrike, { code: 'INVALID_INPUT', field: 'lowerStrike1e9' });
    expectPtbError(invalidRangeOrder, { code: 'INVALID_RANGE', field: 'lowerStrike1e9' });
  });

  it('fails safely when quantity is zero or negative', () => {
    const zeroResult = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: 0n,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });
    const negativeResult = buildMintRangeTx({
      managerId: ptbManagerId,
      quantityQuote: -1n,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });

    expectPtbError(zeroResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
    expectPtbError(negativeResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
  });
});
