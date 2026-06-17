import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  predictProtocolTypes,
  predictTargetRegistryMetadata,
  predictTxTargets,
} from '@/integrations/deepbook-predict/targets';

const documentedTargets = {
  marketKey: {
    down: 'market_key::down',
    new: 'market_key::new',
    up: 'market_key::up',
  },
  predict: {
    askBounds: 'predict::ask_bounds',
    createManager: 'predict::create_manager',
    getRangeTradeAmounts: 'predict::get_range_trade_amounts',
    getTradeAmounts: 'predict::get_trade_amounts',
    mint: 'predict::mint',
    mintRange: 'predict::mint_range',
    redeem: 'predict::redeem',
    redeemPermissionless: 'predict::redeem_permissionless',
    redeemRange: 'predict::redeem_range',
    supply: 'predict::supply',
    withdraw: 'predict::withdraw',
  },
  predictManager: {
    deposit: 'predict_manager::deposit',
    withdraw: 'predict_manager::withdraw',
  },
  rangeKey: {
    new: 'range_key::new',
  },
} as const;

describe('DeepBook Predict target registry', () => {
  it('builds all documented targets from the configured package ID', () => {
    expect(predictTxTargets).toEqual({
      marketKey: {
        down: `${predictDeploymentConfig.packageId}::${documentedTargets.marketKey.down}`,
        new: `${predictDeploymentConfig.packageId}::${documentedTargets.marketKey.new}`,
        up: `${predictDeploymentConfig.packageId}::${documentedTargets.marketKey.up}`,
      },
      predict: {
        askBounds: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.askBounds}`,
        createManager: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.createManager}`,
        getRangeTradeAmounts: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.getRangeTradeAmounts}`,
        getTradeAmounts: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.getTradeAmounts}`,
        mint: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.mint}`,
        mintRange: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.mintRange}`,
        redeem: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.redeem}`,
        redeemPermissionless: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.redeemPermissionless}`,
        redeemRange: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.redeemRange}`,
        supply: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.supply}`,
        withdraw: `${predictDeploymentConfig.packageId}::${documentedTargets.predict.withdraw}`,
      },
      predictManager: {
        deposit: `${predictDeploymentConfig.packageId}::${documentedTargets.predictManager.deposit}`,
        withdraw: `${predictDeploymentConfig.packageId}::${documentedTargets.predictManager.withdraw}`,
      },
      rangeKey: {
        new: `${predictDeploymentConfig.packageId}::${documentedTargets.rangeKey.new}`,
      },
    });
  });

  it('keeps protocol coin types config-driven', () => {
    expect(predictProtocolTypes).toEqual({
      plpType: predictDeploymentConfig.plpType,
      quoteAssetType: predictDeploymentConfig.quoteAsset.type,
    });
  });

  it('records the manual registry strategy and deferred codegen state', () => {
    expect(predictTargetRegistryMetadata).toMatchObject({
      codegenStatus: 'deferred',
      packageId: predictDeploymentConfig.packageId,
      sourceBranch: predictDeploymentConfig.sourceBranch,
      strategy: 'manual-registry',
    });
    expect(predictTargetRegistryMetadata.todoVerify).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Clock object'),
        expect.stringContaining('pure ID argument'),
        expect.stringContaining('generated bindings'),
      ]),
    );
  });

  it('does not export unsupported target groups', () => {
    expect(Object.keys(predictTxTargets).sort((left, right) => left.localeCompare(right))).toEqual([
      'marketKey',
      'predict',
      'predictManager',
      'rangeKey',
    ]);
  });
});
