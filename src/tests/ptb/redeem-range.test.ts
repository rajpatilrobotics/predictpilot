import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictTxTargets } from '@/integrations/deepbook-predict/targets';
import { buildRedeemRangeTx } from '@/integrations/deepbook-predict/tx/redeem-range';
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

describe('buildRedeemRangeTx', () => {
  it('builds RangeKey first, then predict redeem_range with DUSDC and clock', () => {
    const result = expectPtbOk(
      buildRedeemRangeTx({
        managerId: ptbManagerId,
        quantityQuote: ptbQuantityQuote,
        rangeKey: ptbRangeKey,
        sender: ptbSender,
      }),
    );

    expectRangeTradeTransaction({
      actionFunction: 'redeem_range',
      actionTarget: predictTxTargets.predict.redeemRange,
      data: result.transaction.getData(),
    });
  });

  it('returns a preview and execution request for later signing', () => {
    const result = expectPtbOk(
      buildRedeemRangeTx({
        managerId: ptbManagerId,
        quantityQuote: ptbQuantityQuote,
        rangeKey: ptbRangeKey,
        sender: ptbSender,
      }),
    );

    expect(result.preview).toMatchObject({
      action: 'REDEEM_RANGE',
      affectedObjects: expectedPredictManagerOracleHints(),
      description: 'Redeem a range position back into the selected PredictManager balance.',
      expectedNetwork: 'testnet',
      managerId: ptbManagerId,
      oracleId: ptbOracleId,
      quantityQuote: ptbQuantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
      target: predictTxTargets.predict.redeemRange,
      title: 'Redeem range position',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'REDEEM_RANGE',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender: ptbSender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildRedeemRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: ptbRangeKey,
    });

    expectWalletDisconnected(result, {
      action: 'REDEEM_RANGE',
      builder: 'buildRedeemRangeTx',
    });
  });

  it('fails safely for invalid object IDs and range fields', () => {
    const invalidManager = buildRedeemRangeTx({
      managerId: '0xnot-a-manager',
      quantityQuote: ptbQuantityQuote,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });
    const invalidOracle = buildRedeemRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        oracleId: '0xnot-an-oracle',
      },
      sender: ptbSender,
    });
    const invalidHigherStrike = buildRedeemRangeTx({
      managerId: ptbManagerId,
      quantityQuote: ptbQuantityQuote,
      rangeKey: {
        ...ptbRangeKey,
        higherStrike1e9: -1n,
      },
      sender: ptbSender,
    });
    const invalidRangeOrder = buildRedeemRangeTx({
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
    expectPtbError(invalidHigherStrike, { code: 'INVALID_INPUT', field: 'higherStrike1e9' });
    expectPtbError(invalidRangeOrder, { code: 'INVALID_RANGE', field: 'lowerStrike1e9' });
  });

  it('fails safely when quantity is zero or negative', () => {
    const zeroResult = buildRedeemRangeTx({
      managerId: ptbManagerId,
      quantityQuote: 0n,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });
    const negativeResult = buildRedeemRangeTx({
      managerId: ptbManagerId,
      quantityQuote: -1n,
      rangeKey: ptbRangeKey,
      sender: ptbSender,
    });

    expectPtbError(zeroResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
    expectPtbError(negativeResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
  });
});
