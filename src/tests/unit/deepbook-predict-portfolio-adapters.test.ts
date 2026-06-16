import { describe, expect, it, vi } from 'vitest';
import {
  getManagerPnl,
  getManagerPositionsSummary,
  getManagers,
  getManagerSummary,
} from '@/integrations/deepbook-predict/api/portfolio';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3';
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';
const packageId = 'f5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

const eventBase = {
  event_digest: 'event-digest',
  digest: 'digest',
  sender: owner,
  checkpoint: 349_210_521,
  checkpoint_timestamp_ms: 1_781_632_411_083,
  tx_index: 3,
  event_index: 1,
  package: packageId,
};

function createClient(overrides: Partial<PortfolioReadClient>): PortfolioReadClient {
  return {
    fetchManagerPnlDto: vi.fn(),
    fetchManagerPositionsSummaryDto: vi.fn(),
    fetchManagerSummaryDto: vi.fn(),
    fetchManagersDto: vi.fn(),
    ...overrides,
  };
}

describe('portfolio read adapters', () => {
  it('maps manager discovery rows into manager-created models', async () => {
    const client = createClient({
      fetchManagersDto: vi.fn().mockResolvedValue([
        {
          ...eventBase,
          manager_id: managerId,
          owner,
        },
      ]),
    });

    const managers = await getManagers({ client });

    expect(managers[0]).toMatchObject({
      checkpoint: 349_210_521n,
      managerId,
      owner,
      packageId: `0x${packageId}`,
    });
  });

  it('maps manager summary balances and PnL totals', async () => {
    const client = createClient({
      fetchManagerSummaryDto: vi.fn().mockResolvedValue({
        account_value: 25_020_785,
        awaiting_settlement_positions: 0,
        balances: [{ balance: 0, quote_asset: quoteAsset }],
        manager_id: managerId,
        open_exposure: 21_861_452,
        open_positions: 1,
        owner,
        realized_pnl: -11_603_893,
        redeemable_value: 0,
        trading_balance: 0,
        unrealized_pnl: 3_159_333,
      }),
    });

    const summary = await getManagerSummary({ client, managerId });

    expect(summary.managerId).toBe(managerId);
    expect(summary.owner).toBe(owner);
    expect(summary.balances[0]).toEqual({
      balanceQuote: 0n,
      quoteAssetType: `0x${quoteAsset}`,
    });
    expect(summary.realizedPnlQuote).toBe(-11_603_893n);
    expect(summary.accountValueQuote).toBe(25_020_785n);
  });

  it('maps manager positions summary as manager-held binary quantities', async () => {
    const client = createClient({
      fetchManagerPositionsSummaryDto: vi.fn().mockResolvedValue([
        {
          average_entry_price: 510_224_061,
          average_exit_price: null,
          expiry: 1_781_647_200_000,
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
          quote_asset: quoteAsset,
          realized_pnl: 0,
          redeemed_quantity: 0,
          status: 'active',
          strike: 65_751_000_000_000,
          total_cost: 21_861_452,
          total_payout: 0,
          underlying_asset: 'BTC',
          unrealized_pnl: 3_149_599,
        },
      ]),
    });

    const positions = await getManagerPositionsSummary({ client, managerId });

    expect(positions.managerId).toBe(managerId);
    expect(positions.rangePositions).toEqual([]);
    expect(positions.binaryPositions[0]).toMatchObject({
      averageEntryPrice1e9: 510_224_061n,
      markPrice1e9: 583_732_499n,
      openQuantityQuote: 42_846_768n,
      quantityQuote: 42_846_768n,
      status: 'active',
    });
    expect(positions.binaryPositions[0]?.key).toEqual({
      direction: 'UP',
      expiryMs: 1_781_647_200_000n,
      oracleId,
      strike1e9: 65_751_000_000_000n,
    });
  });

  it('maps manager PnL object responses into a stable series model', async () => {
    const client = createClient({
      fetchManagerPnlDto: vi.fn().mockResolvedValue({
        current_total_pnl: -8_444_560,
        current_unrealized_pnl: 3_159_333,
        manager_id: managerId,
        points: [
          {
            cumulative_realized_pnl: 4_972_124,
            realized_pnl: 4_972_124,
            timestamp_ms: 1_781_634_027_154,
          },
        ],
        range: 'ALL',
        series_type: 'realized',
      }),
    });

    const pnl = await getManagerPnl({ client, managerId });

    expect(client.fetchManagerPnlDto).toHaveBeenCalledWith(managerId, 'ALL');
    expect(pnl.currentTotalPnlQuote).toBe(-8_444_560n);
    expect(pnl.currentUnrealizedPnlQuote).toBe(3_159_333n);
    expect(pnl.points[0]).toMatchObject({
      cumulativeRealizedPnlQuote: 4_972_124n,
      pnlQuote: 4_972_124n,
      realizedPnlQuote: 4_972_124n,
      timestampMs: 1_781_634_027_154n,
    });
  });

  it('rejects malformed manager quote asset strings during mapping', async () => {
    const client = createClient({
      fetchManagerSummaryDto: vi.fn().mockResolvedValue({
        account_value: 0,
        awaiting_settlement_positions: 0,
        balances: [{ balance: 0, quote_asset: 'bad-type' }],
        manager_id: managerId,
        open_exposure: 0,
        open_positions: 0,
        owner,
        realized_pnl: 0,
        redeemable_value: 0,
        trading_balance: 0,
        unrealized_pnl: 0,
      }),
    });

    await expect(getManagerSummary({ client, managerId })).rejects.toThrow(/Expected a Move type/);
  });
});
