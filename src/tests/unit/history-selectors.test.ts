import { describe, expect, it } from 'vitest';
import { selectTransactionHistory } from '@/features/history/lib/history-selectors';
import type {
  BinaryMintHistoryRecord,
  BinaryRedeemHistoryRecord,
  LpSupplyHistoryRecord,
  LpWithdrawHistoryRecord,
  RangeMintHistoryRecord,
  RangeRedeemHistoryRecord,
} from '@/types/history';
import type { ObjectId, SuiAddress } from '@/types/predict';

const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const otherManagerId =
  '0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const otherOwner =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756d' as SuiAddress;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const predictId = '0x49c25811456d931d4276ec2719f0bbfa9c3b977899f77879d3fcaf4e62864f3f' as ObjectId;
const quoteAsset =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC' as const;

function base(overrides: Record<string, unknown> = {}) {
  return {
    checkpoint: 349_222_343n,
    digest: 'digest-a',
    eventDigest: 'event-digest-a',
    eventIndex: 0,
    packageId: predictId,
    sender: owner,
    timestampMs: 1_781_635_254_964n,
    txIndex: 0,
    ...overrides,
  };
}

function binaryMint(overrides: Partial<BinaryMintHistoryRecord> = {}): BinaryMintHistoryRecord {
  return {
    ...base(),
    askPrice1e9: 510_224_076n,
    costQuote: 21_861_452n,
    key: {
      direction: 'UP',
      expiryMs: 1_781_647_200_000n,
      oracleId,
      strike1e9: 65_751_000_000_000n,
    },
    kind: 'BINARY_MINT',
    managerId,
    predictId,
    quantityQuote: 42_846_768n,
    quoteAssetType: quoteAsset,
    trader: owner,
    ...overrides,
  };
}

function binaryRedeem(
  overrides: Partial<BinaryRedeemHistoryRecord> = {},
): BinaryRedeemHistoryRecord {
  return {
    ...base({ digest: 'digest-b', eventIndex: 1 }),
    executor: owner,
    isSettled: false,
    key: {
      direction: 'DOWN',
      expiryMs: 1_781_647_200_000n,
      oracleId,
      strike1e9: 66_000_000_000_000n,
    },
    kind: 'BINARY_REDEEM',
    managerId,
    owner,
    payoutQuote: 2_000n,
    predictId,
    quantityQuote: 1_000n,
    quoteAssetType: quoteAsset,
    ...overrides,
  };
}

function rangeMint(overrides: Partial<RangeMintHistoryRecord> = {}): RangeMintHistoryRecord {
  return {
    ...base({ digest: 'digest-c', timestampMs: 1_781_635_300_000n }),
    costQuote: 45_069n,
    key: {
      expiryMs: 1_781_856_000_000n,
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracleId,
    },
    kind: 'RANGE_MINT',
    managerId,
    predictId,
    quantityQuote: 50_000n,
    quoteAssetType: quoteAsset,
    trader: owner,
    ...overrides,
  };
}

function rangeRedeem(overrides: Partial<RangeRedeemHistoryRecord> = {}): RangeRedeemHistoryRecord {
  return {
    ...base({ digest: 'digest-d' }),
    isSettled: true,
    key: {
      expiryMs: 1_781_856_000_000n,
      higherStrike1e9: 70_000_000_000_000n,
      lowerStrike1e9: 62_000_000_000_000n,
      oracleId,
    },
    kind: 'RANGE_REDEEM',
    managerId,
    payoutQuote: 60_000n,
    predictId,
    quantityQuote: 50_000n,
    quoteAssetType: quoteAsset,
    trader: owner,
    ...overrides,
  };
}

function lpSupply(overrides: Partial<LpSupplyHistoryRecord> = {}): LpSupplyHistoryRecord {
  return {
    ...base({ digest: 'digest-e', timestampMs: 1_781_635_280_000n }),
    kind: 'LP_SUPPLY',
    mintedPlpAtomic: 9_981_615n,
    predictId,
    provider: owner,
    quoteAssetType: quoteAsset,
    suppliedQuote: 10_000_000n,
    ...overrides,
  };
}

function lpWithdraw(overrides: Partial<LpWithdrawHistoryRecord> = {}): LpWithdrawHistoryRecord {
  return {
    ...base({ digest: 'digest-f', timestampMs: 1_781_635_270_000n }),
    burnedPlpAtomic: 1_000_000n,
    kind: 'LP_WITHDRAW',
    predictId,
    provider: owner,
    quoteAssetType: quoteAsset,
    withdrawnQuote: 1_100_000n,
    ...overrides,
  };
}

describe('history selectors', () => {
  it('returns an empty server-backed timeline', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [],
      lpWithdrawals: [],
      managerId,
      owner,
      positionMints: [],
      positionRedeems: [],
      rangeMints: [],
      rangeRedeems: [],
    });

    expect(timeline).toMatchObject({
      isEmpty: true,
      latestTimestampMs: null,
      managerId,
      owner,
      records: [],
      totalCount: 0,
    });
    expect(timeline.countsByKind.BINARY_MINT).toBe(0);
  });

  it('builds a mixed timeline sorted newest-first', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [lpSupply()],
      lpWithdrawals: [lpWithdraw()],
      managerId,
      owner,
      positionMints: [binaryMint({ timestampMs: 1_781_635_250_000n })],
      positionRedeems: [binaryRedeem({ timestampMs: 1_781_635_260_000n })],
      rangeMints: [rangeMint()],
      rangeRedeems: [rangeRedeem({ timestampMs: 1_781_635_260_000n })],
    });

    expect(timeline.records.map((record) => record.kind)).toEqual([
      'RANGE_MINT',
      'LP_SUPPLY',
      'LP_WITHDRAW',
      'BINARY_REDEEM',
      'RANGE_REDEEM',
      'BINARY_MINT',
    ]);
    expect(timeline.latestTimestampMs).toBe(1_781_635_300_000n);
  });

  it('filters position and range records by active manager', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [],
      lpWithdrawals: [],
      managerId,
      owner,
      positionMints: [binaryMint(), binaryMint({ managerId: otherManagerId })],
      positionRedeems: [binaryRedeem({ managerId: otherManagerId })],
      rangeMints: [rangeMint()],
      rangeRedeems: [rangeRedeem({ managerId: otherManagerId })],
    });

    expect(timeline.records.map((record) => record.kind)).toEqual(['RANGE_MINT', 'BINARY_MINT']);
    expect(timeline.feeds.positionMints).toHaveLength(1);
    expect(timeline.feeds.rangeRedeems).toEqual([]);
  });

  it('filters LP records by active wallet provider', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [lpSupply(), lpSupply({ provider: otherOwner })],
      lpWithdrawals: [lpWithdraw({ provider: otherOwner }), lpWithdraw()],
      managerId,
      owner,
      positionMints: [],
      positionRedeems: [],
      rangeMints: [],
      rangeRedeems: [],
    });

    expect(timeline.records.map((record) => record.kind)).toEqual(['LP_SUPPLY', 'LP_WITHDRAW']);
    expect(timeline.feeds.lpSupplies).toHaveLength(1);
    expect(timeline.feeds.lpWithdrawals).toHaveLength(1);
  });

  it('does not leak global LP history when owner is unknown', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [lpSupply()],
      lpWithdrawals: [lpWithdraw()],
      managerId,
      owner: null,
      positionMints: [binaryMint()],
      positionRedeems: [],
      rangeMints: [],
      rangeRedeems: [],
    });

    expect(timeline.records.map((record) => record.kind)).toEqual(['BINARY_MINT']);
    expect(timeline.feeds.lpSupplies).toEqual([]);
    expect(timeline.feeds.lpWithdrawals).toEqual([]);
  });

  it('counts records by history kind', () => {
    const timeline = selectTransactionHistory({
      lpSupplies: [lpSupply()],
      lpWithdrawals: [lpWithdraw()],
      managerId,
      owner,
      positionMints: [binaryMint()],
      positionRedeems: [binaryRedeem()],
      rangeMints: [rangeMint()],
      rangeRedeems: [rangeRedeem()],
    });

    expect(timeline.countsByKind).toMatchObject({
      BINARY_MINT: 1,
      BINARY_REDEEM: 1,
      LP_SUPPLY: 1,
      LP_WITHDRAW: 1,
      ORACLE_TRADE: 0,
      RANGE_MINT: 1,
      RANGE_REDEEM: 1,
    });
  });
});
