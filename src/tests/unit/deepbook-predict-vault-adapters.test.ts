import { describe, expect, it, vi } from 'vitest';
import { getVaultPerformance, getVaultSummary } from '@/integrations/deepbook-predict/api/vault';
import type { VaultReadClient } from '@/integrations/deepbook-predict/api/vault';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

const vaultSummaryFixture = {
  available_liquidity: 1_013_621_323_890,
  available_withdrawal: 1_013_621_323_890,
  max_payout_utilization: 0.0020975390715985472,
  net_deposits: 1_013_136_152_701,
  plp_share_price: 1.0018485537482182,
  plp_total_supply: 1_013_114_841_700,
  predict_id: predictId,
  quote_assets: [quoteAsset],
  total_max_payout: 2_130_579_304,
  total_mtm: 764_264_256,
  total_supplied: 1_072_609_144_409,
  total_withdrawn: 59_472_991_708,
  utilization: 0.0007524123298187235,
  vault_balance: 1_015_751_903_194,
  vault_value: 1_014_987_638_938,
};

describe('vault read adapters', () => {
  it('maps vault summary into an app-native model', async () => {
    const client: VaultReadClient = {
      fetchVaultPerformanceDto: vi.fn(),
      fetchVaultSummaryDto: vi.fn().mockResolvedValue(vaultSummaryFixture),
    };

    const summary = await getVaultSummary({ client, predictId });

    expect(summary.predictId).toBe(predictId);
    expect(summary.quoteAssetType).toBe(`0x${quoteAsset}`);
    expect(summary.vaultBalanceQuote).toBe(1_015_751_903_194n);
    expect(summary.vaultValueQuote).toBe(1_014_987_638_938n);
    expect(summary.plpTotalSupplyAtomic).toBe(1_013_114_841_700n);
    expect(summary.plpSharePrice).toBeCloseTo(1.0018485537482182);
  });

  it('maps vault performance points from range=ALL', async () => {
    const client: VaultReadClient = {
      fetchVaultPerformanceDto: vi.fn().mockResolvedValue({
        points: [
          {
            share_price: 1,
            timestamp_ms: 1_776_715_922_850,
            total_shares: 1_000_000_000_000,
            vault_value: 1_000_000_000_000,
          },
        ],
        predict_id: predictId,
        range: 'ALL',
      }),
      fetchVaultSummaryDto: vi.fn(),
    };

    const performance = await getVaultPerformance({ client, predictId });

    expect(client.fetchVaultPerformanceDto).toHaveBeenCalledWith(predictId, 'ALL');
    expect(performance.points[0]).toEqual({
      sharePrice: 1,
      timestampMs: 1_776_715_922_850n,
      totalSharesAtomic: 1_000_000_000_000n,
      vaultValueQuote: 1_000_000_000_000n,
    });
  });

  it('rejects malformed quote asset strings during mapping', async () => {
    const client: VaultReadClient = {
      fetchVaultPerformanceDto: vi.fn(),
      fetchVaultSummaryDto: vi.fn().mockResolvedValue({
        ...vaultSummaryFixture,
        quote_assets: ['not-a-move-type'],
      }),
    };

    await expect(getVaultSummary({ client, predictId })).rejects.toThrow(/Expected a Move type/);
  });
});
