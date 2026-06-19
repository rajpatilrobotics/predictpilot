import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { getOracleState, getAskBounds } from '@/integrations/deepbook-predict/api/oracles';
import { getPredictOracles, getPredictState } from '@/integrations/deepbook-predict/api/markets';
import {
  getManagerPnl,
  getManagerPositionsSummary,
  getManagers,
  getManagerSummary,
} from '@/integrations/deepbook-predict/api/portfolio';
import { getVaultPerformance, getVaultSummary } from '@/integrations/deepbook-predict/api/vault';
import {
  getLpSuppliesHistory,
  getLpWithdrawalsHistory,
  getOracleTrades,
  getPositionMintHistory,
  getPositionRedeemHistory,
  getRangeMintHistory,
  getRangeRedeemHistory,
} from '@/integrations/deepbook-predict/api/history';
import { createPredictServerClient } from '@/integrations/deepbook-predict/client';
import type { FetchLike } from '@/lib/http';
import type { ObjectId, SuiAddress } from '@/types/predict';

const baseUrl = 'https://predict-server.testnet.mystenlabs.com';
const predictId = predictDeploymentConfig.predictObjectId;
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const packageId = predictDeploymentConfig.packageId.slice(2);
const quoteAssetWithoutPrefix = predictDeploymentConfig.quoteAsset.type.slice(2);

const eventBase = {
  checkpoint: 349_210_521,
  checkpoint_timestamp_ms: 1_781_632_411_083,
  digest: 'indexed-digest',
  event_digest: 'indexed-event-digest',
  event_index: 1,
  package: packageId,
  sender: owner,
  tx_index: 3,
};

const oracleSummary = {
  activated_at: 1_781_634_686_445,
  created_checkpoint: 349_219_640,
  expiry: 1_781_647_200_000,
  min_strike: 65_000_000_000_000,
  oracle_cap_id: oracleId,
  oracle_id: oracleId,
  predict_id: predictId,
  settlement_price: null,
  settled_at: null,
  status: 'active',
  tick_size: 1_000_000_000,
  underlying_asset: 'BTC',
};

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: {
        'content-type': 'application/json',
      },
      status: 200,
    }),
  );
}

function responseForPath(pathname: string) {
  if (pathname === '/status') {
    return jsonResponse({
      current_time_ms: 1_800_000_000_000,
      earliest_checkpoint: 50,
      latest_onchain_checkpoint: 100,
      max_checkpoint_lag: 1,
      max_lag_pipeline: 'oracle_prices',
      max_time_lag_seconds: 2,
      pipelines: [
        {
          checkpoint_lag: 1,
          indexed_checkpoint: 99,
          indexed_epoch: 10,
          indexed_timestamp_ms: 1_800_000_000_000,
          latest_onchain_checkpoint: 100,
          pipeline: 'oracle_prices',
          time_lag_seconds: 2,
        },
      ],
      status: 'OK',
    });
  }

  if (pathname === `/predicts/${predictId}/state`) {
    return jsonResponse({
      predict_id: predictId,
      pricing: { present: true },
      quote_assets: [quoteAssetWithoutPrefix],
      risk: null,
      trading_paused: false,
    });
  }

  if (pathname === `/predicts/${predictId}/oracles`) {
    return jsonResponse([oracleSummary]);
  }

  if (pathname === `/oracles/${oracleId}/state`) {
    return jsonResponse({
      ask_bounds: { present: true },
      latest_price: {
        ...eventBase,
        forward: 65_200_000_000_000,
        onchain_timestamp: 1_781_634_686_445,
        oracle_id: oracleId,
        spot: 65_100_000_000_000,
      },
      latest_svi: {
        ...eventBase,
        a: 1,
        b: 2,
        m: 4,
        m_negative: true,
        onchain_timestamp: 1_781_634_686_446,
        oracle_id: oracleId,
        rho: 3,
        rho_negative: false,
        sigma: 5,
      },
      oracle: oracleSummary,
    });
  }

  if (pathname === `/oracles/${oracleId}/ask-bounds`) {
    return jsonResponse(null);
  }

  if (pathname === `/predicts/${predictId}/vault/summary`) {
    return jsonResponse({
      available_liquidity: 4_000_000,
      available_withdrawal: 3_000_000,
      max_payout_utilization: 0.25,
      net_deposits: 5_000_000,
      plp_share_price: 1.02,
      plp_total_supply: 5_000_000,
      predict_id: predictId,
      quote_assets: [quoteAssetWithoutPrefix],
      total_max_payout: 1_000_000,
      total_mtm: 50_000,
      total_supplied: 6_000_000,
      total_withdrawn: 1_000_000,
      utilization: 0.2,
      vault_balance: 5_000_000,
      vault_value: 5_100_000,
    });
  }

  if (pathname === `/predicts/${predictId}/vault/performance`) {
    return jsonResponse({
      points: [
        {
          share_price: 1.02,
          timestamp_ms: 1_781_632_411_083,
          total_shares: 5_000_000,
          vault_value: 5_100_000,
        },
      ],
      predict_id: predictId,
      range: 'ALL',
    });
  }

  if (pathname === '/managers') {
    return jsonResponse([{ ...eventBase, manager_id: managerId, owner }]);
  }

  if (pathname === `/managers/${managerId}/summary`) {
    return jsonResponse({
      account_value: 25_000_000,
      awaiting_settlement_positions: 0,
      balances: [{ balance: 10_000_000, quote_asset: quoteAssetWithoutPrefix }],
      manager_id: managerId,
      open_exposure: 2_000_000,
      open_positions: 1,
      owner,
      realized_pnl: 100_000,
      redeemable_value: 0,
      trading_balance: 10_000_000,
      unrealized_pnl: 50_000,
    });
  }

  if (pathname === `/managers/${managerId}/positions/summary`) {
    return jsonResponse([
      {
        average_entry_price: 510_224_061,
        average_exit_price: null,
        expiry: oracleSummary.expiry,
        first_minted_at: 1_781_635_254_964,
        is_up: true,
        last_activity_at: 1_781_635_254_964,
        manager_id: managerId,
        mark_price: 583_732_499,
        mark_value: 25_011_051,
        minted_quantity: 42_846_768,
        open_cost_basis: 21_861_452,
        open_quantity: 42_846_768,
        oracle_id: oracleId,
        predict_id: predictId,
        quote_asset: quoteAssetWithoutPrefix,
        realized_pnl: 0,
        redeemed_quantity: 0,
        status: 'active',
        strike: oracleSummary.min_strike,
        total_cost: 21_861_452,
        total_payout: 0,
        underlying_asset: 'BTC',
        unrealized_pnl: 3_149_599,
      },
    ]);
  }

  if (pathname === `/managers/${managerId}/pnl`) {
    return jsonResponse({
      current_total_pnl: 150_000,
      current_unrealized_pnl: 50_000,
      manager_id: managerId,
      points: [{ account_value: 25_000_000, timestamp_ms: 1_781_632_411_083, total_pnl: 150_000 }],
      range: 'ALL',
      series_type: 'total',
    });
  }

  if (pathname === '/positions/minted') {
    return jsonResponse([
      {
        ...eventBase,
        ask_price: 500_000_000,
        cost: 1_000_000,
        expiry: oracleSummary.expiry,
        is_up: true,
        manager_id: managerId,
        oracle_id: oracleId,
        predict_id: predictId,
        quantity: 2_000_000,
        quote_asset: quoteAssetWithoutPrefix,
        strike: oracleSummary.min_strike,
        trader: owner,
      },
    ]);
  }

  if (pathname === '/positions/redeemed') {
    return jsonResponse([
      {
        ...eventBase,
        bid_price: 550_000_000,
        executor: owner,
        expiry: oracleSummary.expiry,
        is_settled: false,
        is_up: true,
        manager_id: managerId,
        oracle_id: oracleId,
        owner,
        payout: 1_100_000,
        predict_id: predictId,
        quantity: 2_000_000,
        quote_asset: quoteAssetWithoutPrefix,
        strike: oracleSummary.min_strike,
      },
    ]);
  }

  if (pathname === '/ranges/minted') {
    return jsonResponse([
      {
        ...eventBase,
        ask_price: 400_000_000,
        cost: 800_000,
        expiry: oracleSummary.expiry,
        higher_strike: 66_000_000_000_000,
        lower_strike: 64_000_000_000_000,
        manager_id: managerId,
        oracle_id: oracleId,
        predict_id: predictId,
        quantity: 2_000_000,
        quote_asset: quoteAssetWithoutPrefix,
        trader: owner,
      },
    ]);
  }

  if (pathname === '/ranges/redeemed') {
    return jsonResponse([
      {
        ...eventBase,
        bid_price: 450_000_000,
        expiry: oracleSummary.expiry,
        higher_strike: 66_000_000_000_000,
        is_settled: false,
        lower_strike: 64_000_000_000_000,
        manager_id: managerId,
        oracle_id: oracleId,
        payout: 900_000,
        predict_id: predictId,
        quantity: 2_000_000,
        quote_asset: quoteAssetWithoutPrefix,
        trader: owner,
      },
    ]);
  }

  if (pathname === '/lp/supplies') {
    return jsonResponse([
      {
        ...eventBase,
        amount: 1_500_000,
        predict_id: predictId,
        quote_asset: quoteAssetWithoutPrefix,
        shares_minted: 1_490_000,
        supplier: owner,
      },
    ]);
  }

  if (pathname === '/lp/withdrawals') {
    return jsonResponse([
      {
        ...eventBase,
        amount: 1_200_000,
        predict_id: predictId,
        quote_asset: quoteAssetWithoutPrefix,
        shares_burned: 1_180_000,
        withdrawer: owner,
      },
    ]);
  }

  if (pathname === `/trades/${oracleId}`) {
    return jsonResponse([
      { ...eventBase, oracle_id: oracleId, quantity: 2_000_000, trader: owner },
    ]);
  }

  return Promise.resolve(new Response('{}', { status: 404 }));
}

function urlOf(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}

describe('Predict read integration pipeline', () => {
  it('validates mocked server payloads and maps them into app models', async () => {
    const calledUrls: string[] = [];
    const fetchImpl = vi.fn<FetchLike>((input) => {
      const url = urlOf(input);
      calledUrls.push(`${url.pathname}${url.search}`);
      return responseForPath(url.pathname);
    });
    const client = createPredictServerClient({ baseUrl, fetchImpl, retries: 0 });

    const status = await client.fetchPredictServerStatus();
    const predictState = await getPredictState({ client, predictId });
    const oracles = await getPredictOracles({ client, predictId });
    const oracleState = await getOracleState({ client, oracleId });
    const askBounds = await getAskBounds({ client, oracleId });
    const vaultSummary = await getVaultSummary({ client, predictId });
    const vaultPerformance = await getVaultPerformance({ client, predictId });
    const managers = await getManagers({ client });
    const managerSummary = await getManagerSummary({ client, managerId });
    const positions = await getManagerPositionsSummary({ client, managerId });
    const pnl = await getManagerPnl({ client, managerId });
    const binaryMints = await getPositionMintHistory({ client });
    const binaryRedeems = await getPositionRedeemHistory({ client });
    const rangeMints = await getRangeMintHistory({ client });
    const rangeRedeems = await getRangeRedeemHistory({ client });
    const lpSupplies = await getLpSuppliesHistory({ client });
    const lpWithdrawals = await getLpWithdrawalsHistory({ client });
    const oracleTrades = await getOracleTrades({ client, oracleId });

    expect(status.status).toBe('OK');
    expect(predictState).toMatchObject({
      predictId,
      pricingStatus: 'PRESENT',
      quoteAssets: [predictDeploymentConfig.quoteAsset.type],
      riskStatus: 'MISSING',
      tradingPaused: false,
    });
    expect(oracles[0]).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      oracleId,
      underlyingAsset: 'BTC',
    });
    expect(oracleState.latestPrice?.spot1e9).toBe(65_100_000_000_000n);
    expect(oracleState.latestSvi?.svi.m1e9Signed).toBe(-4n);
    expect(askBounds.status).toBe('UNAVAILABLE');
    expect(vaultSummary).toMatchObject({
      plpTotalSupplyAtomic: 5_000_000n,
      quoteAssetType: predictDeploymentConfig.quoteAsset.type,
      vaultValueQuote: 5_100_000n,
    });
    expect(vaultPerformance.points[0]?.sharePrice).toBe(1.02);
    expect(managers[0]).toMatchObject({ managerId, owner });
    expect(managerSummary.tradingBalanceQuote).toBe(10_000_000n);
    expect(positions.binaryPositions[0]?.key).toMatchObject({ direction: 'UP', oracleId });
    expect(pnl.currentTotalPnlQuote).toBe(150_000n);
    expect(binaryMints[0]).toMatchObject({ kind: 'BINARY_MINT', managerId });
    expect(binaryRedeems[0]).toMatchObject({ kind: 'BINARY_REDEEM', managerId });
    expect(rangeMints[0]).toMatchObject({ kind: 'RANGE_MINT', managerId });
    expect(rangeRedeems[0]).toMatchObject({ kind: 'RANGE_REDEEM', managerId });
    expect(lpSupplies[0]).toMatchObject({ kind: 'LP_SUPPLY', provider: owner });
    expect(lpWithdrawals[0]).toMatchObject({ kind: 'LP_WITHDRAW', provider: owner });
    expect(oracleTrades[0]).toMatchObject({ kind: 'ORACLE_TRADE', oracleId });
    expect(calledUrls).toEqual(
      expect.arrayContaining([
        '/status',
        `/predicts/${predictId}/state`,
        `/predicts/${predictId}/oracles`,
        `/oracles/${oracleId}/state`,
        `/oracles/${oracleId}/ask-bounds`,
        `/predicts/${predictId}/vault/performance?range=ALL`,
        `/managers/${managerId}/pnl?range=ALL`,
        `/trades/${oracleId}`,
      ]),
    );
  });
});
