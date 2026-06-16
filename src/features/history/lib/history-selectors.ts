import type {
  BinaryMintHistoryRecord,
  BinaryRedeemHistoryRecord,
  LpSupplyHistoryRecord,
  LpWithdrawHistoryRecord,
  ProtocolHistoryRecord,
  RangeMintHistoryRecord,
  RangeRedeemHistoryRecord,
} from '@/types/history';
import type { ObjectId, SuiAddress, TimestampMs } from '@/types/predict';

export type TransactionHistoryKind = ProtocolHistoryRecord['kind'];

export type TransactionHistoryCounts = Record<TransactionHistoryKind, number>;

export interface TransactionHistoryFeeds {
  lpSupplies: LpSupplyHistoryRecord[];
  lpWithdrawals: LpWithdrawHistoryRecord[];
  positionMints: BinaryMintHistoryRecord[];
  positionRedeems: BinaryRedeemHistoryRecord[];
  rangeMints: RangeMintHistoryRecord[];
  rangeRedeems: RangeRedeemHistoryRecord[];
}

export interface SelectTransactionHistoryOptions extends TransactionHistoryFeeds {
  managerId: ObjectId | null;
  owner: SuiAddress | null;
}

export interface TransactionHistoryTimelineModel {
  countsByKind: TransactionHistoryCounts;
  feeds: TransactionHistoryFeeds;
  isEmpty: boolean;
  latestTimestampMs: TimestampMs | null;
  managerId: ObjectId | null;
  owner: SuiAddress | null;
  records: ProtocolHistoryRecord[];
  totalCount: number;
}

const EMPTY_COUNTS: TransactionHistoryCounts = {
  BINARY_MINT: 0,
  BINARY_REDEEM: 0,
  LP_SUPPLY: 0,
  LP_WITHDRAW: 0,
  ORACLE_TRADE: 0,
  RANGE_MINT: 0,
  RANGE_REDEEM: 0,
};

export function selectTransactionHistory({
  lpSupplies,
  lpWithdrawals,
  managerId,
  owner,
  positionMints,
  positionRedeems,
  rangeMints,
  rangeRedeems,
}: SelectTransactionHistoryOptions): TransactionHistoryTimelineModel {
  const feeds: TransactionHistoryFeeds = {
    lpSupplies: owner === null ? [] : lpSupplies.filter((record) => record.provider === owner),
    lpWithdrawals:
      owner === null ? [] : lpWithdrawals.filter((record) => record.provider === owner),
    positionMints:
      managerId === null ? [] : positionMints.filter((record) => record.managerId === managerId),
    positionRedeems:
      managerId === null ? [] : positionRedeems.filter((record) => record.managerId === managerId),
    rangeMints:
      managerId === null ? [] : rangeMints.filter((record) => record.managerId === managerId),
    rangeRedeems:
      managerId === null ? [] : rangeRedeems.filter((record) => record.managerId === managerId),
  };
  const records = sortHistoryRecords([
    ...feeds.positionMints,
    ...feeds.positionRedeems,
    ...feeds.rangeMints,
    ...feeds.rangeRedeems,
    ...feeds.lpSupplies,
    ...feeds.lpWithdrawals,
  ]);
  const countsByKind = countHistoryKinds(records);

  return {
    countsByKind,
    feeds,
    isEmpty: records.length === 0,
    latestTimestampMs: records[0]?.timestampMs ?? null,
    managerId,
    owner,
    records,
    totalCount: records.length,
  };
}

export function sortHistoryRecords(records: ProtocolHistoryRecord[]): ProtocolHistoryRecord[] {
  return records
    .map((record, originalIndex) => ({ originalIndex, record }))
    .sort(
      (left, right) =>
        compareHistoryRecords(left.record, right.record) ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ record }) => record);
}

function countHistoryKinds(records: ProtocolHistoryRecord[]): TransactionHistoryCounts {
  const counts = { ...EMPTY_COUNTS };

  for (const record of records) {
    counts[record.kind] += 1;
  }

  return counts;
}

function compareHistoryRecords(left: ProtocolHistoryRecord, right: ProtocolHistoryRecord): number {
  return (
    compareBigintDesc(left.timestampMs, right.timestampMs) ||
    left.digest.localeCompare(right.digest) ||
    compareNumberAsc(left.eventIndex, right.eventIndex) ||
    compareNumberAsc(left.txIndex, right.txIndex)
  );
}

function compareBigintDesc(left: bigint, right: bigint): number {
  if (left > right) {
    return -1;
  }

  if (left < right) {
    return 1;
  }

  return 0;
}

function compareNumberAsc(left: number | undefined, right: number | undefined): number {
  if (left === right) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  return left - right;
}
