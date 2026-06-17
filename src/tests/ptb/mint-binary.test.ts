import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictTxTargets } from '@/integrations/deepbook-predict/targets';
import { buildMintBinaryTx } from '@/integrations/deepbook-predict/tx/mint-binary';
import type { MarketKeyModel } from '@/types/predict';
import {
  expectBinaryTradeTransaction,
  expectedPredictManagerOracleHints,
  expectPtbError,
  expectPtbOk,
  expectWalletDisconnected,
  ptbManagerId,
  ptbMarketKey,
  ptbOracleId,
  ptbQuantityQuote,
  ptbSender,
} from './ptb-test-helpers';

describe('buildMintBinaryTx', () => {
  it('builds MarketKey first, then predict mint with DUSDC and clock', () => {
    const result = expectPtbOk(
      buildMintBinaryTx({
        managerId: ptbManagerId,
        marketKey: ptbMarketKey,
        quantityQuote: ptbQuantityQuote,
        sender: ptbSender,
      }),
    );

    expectBinaryTradeTransaction({
      actionFunction: 'mint',
      actionTarget: predictTxTargets.predict.mint,
      data: result.transaction.getData(),
    });
  });

  it('uses the down MarketKey target for DOWN direction', () => {
    const result = expectPtbOk(
      buildMintBinaryTx({
        managerId: ptbManagerId,
        marketKey: {
          ...ptbMarketKey,
          direction: 'DOWN',
        },
        quantityQuote: ptbQuantityQuote,
        sender: ptbSender,
      }),
    );

    expectBinaryTradeTransaction({
      actionFunction: 'mint',
      actionTarget: predictTxTargets.predict.mint,
      data: result.transaction.getData(),
      marketKeyFunction: 'down',
      marketKeyTarget: predictTxTargets.marketKey.down,
    });
  });

  it('returns a preview and execution request for later signing', () => {
    const result = expectPtbOk(
      buildMintBinaryTx({
        managerId: ptbManagerId,
        marketKey: ptbMarketKey,
        quantityQuote: ptbQuantityQuote,
        sender: ptbSender,
      }),
    );

    expect(result.preview).toMatchObject({
      action: 'MINT',
      affectedObjects: expectedPredictManagerOracleHints(),
      description: 'Mint a binary position from the selected PredictManager balance.',
      direction: 'UP',
      expectedNetwork: 'testnet',
      managerId: ptbManagerId,
      marketKey: ptbMarketKey,
      oracleId: ptbOracleId,
      quantityQuote: ptbQuantityQuote,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender: ptbSender,
      target: predictTxTargets.predict.mint,
      title: 'Mint binary position',
    });
    expect(result.preview.postTransactionRefreshKeys.length).toBeGreaterThan(0);
    expect(result.executionRequest).toMatchObject({
      action: 'MINT',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender: ptbSender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: ptbMarketKey,
      quantityQuote: ptbQuantityQuote,
    });

    expectWalletDisconnected(result, {
      action: 'MINT',
      builder: 'buildMintBinaryTx',
    });
  });

  it('fails safely for invalid object IDs and market key fields', () => {
    const invalidManager = buildMintBinaryTx({
      managerId: '0xnot-a-manager',
      marketKey: ptbMarketKey,
      quantityQuote: ptbQuantityQuote,
      sender: ptbSender,
    });
    const invalidOracle = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: {
        ...ptbMarketKey,
        oracleId: '0xnot-an-oracle',
      },
      quantityQuote: ptbQuantityQuote,
      sender: ptbSender,
    });
    const invalidDirection = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: {
        ...ptbMarketKey,
        direction: 'SIDEWAYS',
      } as unknown as MarketKeyModel,
      quantityQuote: ptbQuantityQuote,
      sender: ptbSender,
    });
    const invalidStrike = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: {
        ...ptbMarketKey,
        strike1e9: -1n,
      },
      quantityQuote: ptbQuantityQuote,
      sender: ptbSender,
    });

    expectPtbError(invalidManager, { code: 'INVALID_INPUT', field: 'managerId' });
    expectPtbError(invalidOracle, { code: 'INVALID_INPUT', field: 'oracleId' });
    expectPtbError(invalidDirection, { code: 'INVALID_INPUT', field: 'direction' });
    expectPtbError(invalidStrike, { code: 'INVALID_INPUT', field: 'strike1e9' });
  });

  it('fails safely when quantity is zero or negative', () => {
    const zeroResult = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: ptbMarketKey,
      quantityQuote: 0n,
      sender: ptbSender,
    });
    const negativeResult = buildMintBinaryTx({
      managerId: ptbManagerId,
      marketKey: ptbMarketKey,
      quantityQuote: -1n,
      sender: ptbSender,
    });

    expectPtbError(zeroResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
    expectPtbError(negativeResult, { code: 'INVALID_INPUT', field: 'quantityQuote' });
  });
});
