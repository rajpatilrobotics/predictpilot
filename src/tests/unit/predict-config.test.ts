import { describe, expect, it } from 'vitest';
import {
  PREDICT_SOURCE_BRANCH,
  PREDICT_VERIFIED_RANGE,
  predictDeploymentConfig,
  predictServerEndpoints,
  predictVerifiedRangeQuery,
} from '@/config/predict';
import type { ObjectId } from '@/types/predict';

const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;

describe('Predict deployment config registry', () => {
  it('exposes the current provisional Testnet deployment values', () => {
    expect(predictDeploymentConfig).toMatchObject({
      network: 'testnet',
      packageId: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
      plpType: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP',
      predictObjectId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
      quoteAsset: {
        currencyId: '0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c',
        decimals: 6,
        symbol: 'DUSDC',
        type: '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
      },
      registryId: '0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64',
      serverBaseUrl: 'https://predict-server.testnet.mystenlabs.com',
      sourceBranch: PREDICT_SOURCE_BRANCH,
    });
    expect(predictDeploymentConfig.defaultMarketId).toBeUndefined();
    expect(predictDeploymentConfig.defaultOracleId).toBeUndefined();
  });

  it('builds documented Predict server paths from the registry', () => {
    const predictId = predictDeploymentConfig.predictObjectId;

    expect(predictServerEndpoints.status()).toBe('/status');
    expect(predictServerEndpoints.predictState(predictId)).toBe(`/predicts/${predictId}/state`);
    expect(predictServerEndpoints.predictOracles(predictId)).toBe(`/predicts/${predictId}/oracles`);
    expect(predictServerEndpoints.predictQuoteAssets(predictId)).toBe(
      `/predicts/${predictId}/quote-assets`,
    );
    expect(predictServerEndpoints.oracleState(oracleId)).toBe(`/oracles/${oracleId}/state`);
    expect(predictServerEndpoints.oracleAskBounds(oracleId)).toBe(
      `/oracles/${oracleId}/ask-bounds`,
    );
    expect(predictServerEndpoints.oraclePrices(oracleId)).toBe(`/oracles/${oracleId}/prices`);
    expect(predictServerEndpoints.oracleLatestPrice(oracleId)).toBe(
      `/oracles/${oracleId}/prices/latest`,
    );
    expect(predictServerEndpoints.oracleSvi(oracleId)).toBe(`/oracles/${oracleId}/svi`);
    expect(predictServerEndpoints.oracleLatestSvi(oracleId)).toBe(
      `/oracles/${oracleId}/svi/latest`,
    );
    expect(predictServerEndpoints.oracleTrades(oracleId)).toBe(`/trades/${oracleId}`);
    expect(predictServerEndpoints.vaultSummary(predictId)).toBe(
      `/predicts/${predictId}/vault/summary`,
    );
    expect(predictServerEndpoints.vaultPerformance(predictId)).toBe(
      `/predicts/${predictId}/vault/performance`,
    );
    expect(predictServerEndpoints.managers()).toBe('/managers');
    expect(predictServerEndpoints.managerSummary(managerId)).toBe(`/managers/${managerId}/summary`);
    expect(predictServerEndpoints.managerPositionsSummary(managerId)).toBe(
      `/managers/${managerId}/positions/summary`,
    );
    expect(predictServerEndpoints.managerPnl(managerId)).toBe(`/managers/${managerId}/pnl`);
    expect(predictServerEndpoints.historyPositionsMinted()).toBe('/positions/minted');
    expect(predictServerEndpoints.historyPositionsRedeemed()).toBe('/positions/redeemed');
    expect(predictServerEndpoints.historyRangesMinted()).toBe('/ranges/minted');
    expect(predictServerEndpoints.historyRangesRedeemed()).toBe('/ranges/redeemed');
    expect(predictServerEndpoints.historyLpSupplies()).toBe('/lp/supplies');
    expect(predictServerEndpoints.historyLpWithdrawals()).toBe('/lp/withdrawals');
    expect(predictVerifiedRangeQuery()).toEqual({ range: PREDICT_VERIFIED_RANGE });
  });
});
