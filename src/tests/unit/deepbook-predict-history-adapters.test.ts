import { describe, expect, it, vi } from 'vitest';
import {
  getLpSuppliesHistory,
  getOracleTrades,
  getPositionMintHistory,
  getRangeMintHistory,
} from '@/integrations/deepbook-predict/api/history';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';

const predictId = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3';
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';
const packageId = 'f5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';

const eventBase = {
  event_digest: 'event-digest',
  digest: 'digest',
  sender,
  checkpoint: 349_222_343,
  checkpoint_timestamp_ms: 1_781_635_254_964,
  tx_index: 7,
  event_index: 4,
  package: packageId,
};

function createClient(overrides: Partial<HistoryReadClient>): HistoryReadClient {
  return {
    fetchLpSuppliesHistoryDto: vi.fn(),
    fetchLpWithdrawalsHistoryDto: vi.fn(),
    fetchOracleTradesDto: vi.fn(),
    fetchPositionMintHistoryDto: vi.fn(),
    fetchPositionRedeemHistoryDto: vi.fn(),
    fetchRangeMintHistoryDto: vi.fn(),
    fetchRangeRedeemHistoryDto: vi.fn(),
    ...overrides,
  };
}

describe('history read adapters', () => {
  it('maps binary mint history records with market keys', async () => {
    const client = createClient({
      fetchPositionMintHistoryDto: vi.fn().mockResolvedValue([
        {
          ...eventBase,
          ask_price: 510_224_076,
          cost: 21_861_452,
          expiry: 1_781_647_200_000,
          is_up: true,
          manager_id: managerId,
          oracle_id: oracleId,
          predict_id: predictId,
          quantity: 42_846_768,
          quote_asset: quoteAsset,
          strike: 65_751_000_000_000,
          trader: sender,
        },
      ]),
    });

    const records = await getPositionMintHistory({ client });

    expect(records[0]).toMatchObject({
      askPrice1e9: 510_224_076n,
      costQuote: 21_861_452n,
      kind: 'BINARY_MINT',
      managerId,
      packageId: `0x${packageId}`,
      quantityQuote: 42_846_768n,
      quoteAssetType: `0x${quoteAsset}`,
      timestampMs: 1_781_635_254_964n,
      trader: sender,
    });
    expect(records[0]?.key).toEqual({
      direction: 'UP',
      expiryMs: 1_781_647_200_000n,
      oracleId,
      strike1e9: 65_751_000_000_000n,
    });
  });

  it('maps range mint history records with range keys', async () => {
    const client = createClient({
      fetchRangeMintHistoryDto: vi.fn().mockResolvedValue([
        {
          ...eventBase,
          ask_price: 901_396_381,
          cost: 45_069,
          expiry: 1_781_856_000_000,
          higher_strike: 70_000_000_000_000,
          lower_strike: 62_000_000_000_000,
          manager_id: managerId,
          oracle_id: oracleId,
          predict_id: predictId,
          quantity: 50_000,
          quote_asset: quoteAsset,
          trader: sender,
        },
      ]),
    });

    const records = await getRangeMintHistory({ client });

    expect(records[0]).toMatchObject({
      askPrice1e9: 901_396_381n,
      costQuote: 45_069n,
      kind: 'RANGE_MINT',
      quantityQuote: 50_000n,
    });
    expect(records[0]?.key).toEqual({
      expiryMs: 1_781_856_000_000n,
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracleId,
    });
  });

  it('maps LP supply history records into PLP share context', async () => {
    const client = createClient({
      fetchLpSuppliesHistoryDto: vi.fn().mockResolvedValue([
        {
          ...eventBase,
          amount: 10_000_000,
          predict_id: predictId,
          quote_asset: quoteAsset,
          shares_minted: 9_981_615,
          supplier: sender,
        },
      ]),
    });

    const records = await getLpSuppliesHistory({ client });

    expect(records[0]).toMatchObject({
      kind: 'LP_SUPPLY',
      mintedPlpAtomic: 9_981_615n,
      provider: sender,
      suppliedQuote: 10_000_000n,
    });
  });

  it('maps empty oracle trade history without inventing records', async () => {
    const client = createClient({
      fetchOracleTradesDto: vi.fn().mockResolvedValue([]),
    });

    await expect(getOracleTrades({ client, oracleId })).resolves.toEqual([]);
  });

  it('rejects malformed history quote asset strings during mapping', async () => {
    const client = createClient({
      fetchPositionMintHistoryDto: vi.fn().mockResolvedValue([
        {
          ...eventBase,
          cost: 21_861_452,
          expiry: 1_781_647_200_000,
          is_up: true,
          manager_id: managerId,
          oracle_id: oracleId,
          predict_id: predictId,
          quantity: 42_846_768,
          quote_asset: 'bad-type',
          strike: 65_751_000_000_000,
          trader: sender,
        },
      ]),
    });

    await expect(getPositionMintHistory({ client })).rejects.toThrow(/Expected a Move type/);
  });
});
