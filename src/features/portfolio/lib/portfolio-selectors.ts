import type { ObjectId, QuoteAmount, TimestampMs } from '@/types/predict';
import type {
  BinaryPositionSummaryModel,
  ManagerPositionsSummaryModel,
  ManagerQuoteBalanceModel,
  ManagerSummaryModel,
  RangePositionModel,
} from '@/types/portfolio';

export interface ManagerBalanceSummaryModel {
  accountValueQuote: QuoteAmount;
  awaitingSettlementPositions: number;
  balances: ManagerQuoteBalanceModel[];
  managerId: ObjectId;
  openExposureQuote: QuoteAmount;
  openPositions: number;
  owner: string;
  realizedPnlQuote: QuoteAmount;
  redeemableValueQuote: QuoteAmount;
  totalManagerBalanceQuote: QuoteAmount;
  tradingBalanceQuote: QuoteAmount;
  unrealizedPnlQuote: QuoteAmount;
}

export interface ManagerSummaryPortfolioModel {
  balanceSummary: ManagerBalanceSummaryModel;
  summary: ManagerSummaryModel;
}

export interface BinaryPositionGroupModel {
  directions: string[];
  expiryMs: TimestampMs;
  groupKey: string;
  lastActivityAtMs: TimestampMs | null;
  markValueQuote: QuoteAmount | null;
  mintedQuantityQuote: QuoteAmount;
  openCostBasisQuote: QuoteAmount;
  openQuantityQuote: QuoteAmount;
  oracleId: ObjectId;
  positionCount: number;
  positions: BinaryPositionSummaryModel[];
  realizedPnlQuote: QuoteAmount;
  redeemedQuantityQuote: QuoteAmount;
  strikes1e9: bigint[];
  underlyingAsset: string;
  unrealizedPnlQuote: QuoteAmount;
}

export interface RangePositionGroupModel {
  expiryMs: TimestampMs;
  groupKey: string;
  oracleId: ObjectId;
  positionCount: number;
  positions: RangePositionModel[];
  totalQuantityQuote: QuoteAmount;
}

export interface NormalizedManagerPositionsSummaryModel {
  binaryGroups: BinaryPositionGroupModel[];
  binaryPositionCount: number;
  isEmpty: boolean;
  managerId: ObjectId;
  openBinaryPositionCount: number;
  openRangePositionCount: number;
  rangeGroups: RangePositionGroupModel[];
  rangePositionCount: number;
  summary: ManagerPositionsSummaryModel;
  totalOpenBinaryQuantityQuote: QuoteAmount;
  totalOpenRangeQuantityQuote: QuoteAmount;
}

export function selectManagerSummary(summary: ManagerSummaryModel): ManagerSummaryPortfolioModel {
  return {
    balanceSummary: {
      accountValueQuote: summary.accountValueQuote,
      awaitingSettlementPositions: summary.awaitingSettlementPositions,
      balances: summary.balances,
      managerId: summary.managerId,
      openExposureQuote: summary.openExposureQuote,
      openPositions: summary.openPositions,
      owner: summary.owner,
      realizedPnlQuote: summary.realizedPnlQuote,
      redeemableValueQuote: summary.redeemableValueQuote,
      totalManagerBalanceQuote: sumQuoteAmounts(
        summary.balances.map((balance) => balance.balanceQuote),
      ),
      tradingBalanceQuote: summary.tradingBalanceQuote,
      unrealizedPnlQuote: summary.unrealizedPnlQuote,
    },
    summary,
  };
}

export function normalizeManagerPositionsSummary(
  summary: ManagerPositionsSummaryModel,
): NormalizedManagerPositionsSummaryModel {
  const binaryGroups = groupBinaryPositions(summary.binaryPositions);
  const rangeGroups = groupRangePositions(summary.rangePositions);
  const totalOpenBinaryQuantityQuote = sumQuoteAmounts(
    summary.binaryPositions.map((position) => position.openQuantityQuote),
  );
  const totalOpenRangeQuantityQuote = sumQuoteAmounts(
    summary.rangePositions.map((position) => position.quantityQuote),
  );

  return {
    binaryGroups,
    binaryPositionCount: summary.binaryPositions.length,
    isEmpty: summary.binaryPositions.length === 0 && summary.rangePositions.length === 0,
    managerId: summary.managerId,
    openBinaryPositionCount: summary.binaryPositions.filter(
      (position) => position.openQuantityQuote > 0n,
    ).length,
    openRangePositionCount: summary.rangePositions.filter((position) => position.quantityQuote > 0n)
      .length,
    rangeGroups,
    rangePositionCount: summary.rangePositions.length,
    summary,
    totalOpenBinaryQuantityQuote,
    totalOpenRangeQuantityQuote,
  };
}

function groupBinaryPositions(positions: BinaryPositionSummaryModel[]): BinaryPositionGroupModel[] {
  const groups = new Map<string, BinaryPositionSummaryModel[]>();

  for (const position of positions) {
    const groupKey = positionGroupKey(position.key.oracleId, position.key.expiryMs);
    const groupedPositions = groups.get(groupKey) ?? [];
    groupedPositions.push(position);
    groups.set(groupKey, groupedPositions);
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupedPositions]) => {
      const sortedPositions = [...groupedPositions].sort(compareBinaryPositions);
      const firstPosition = sortedPositions[0];

      return {
        directions: uniqueSortedStrings(sortedPositions.map((position) => position.key.direction)),
        expiryMs: firstPosition.key.expiryMs,
        groupKey,
        lastActivityAtMs: maxTimestamp(
          sortedPositions.map((position) => position.lastActivityAtMs),
        ),
        markValueQuote: sumOptionalQuoteAmounts(
          sortedPositions.map((position) => position.markValueQuote),
        ),
        mintedQuantityQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.mintedQuantityQuote),
        ),
        openCostBasisQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.openCostBasisQuote),
        ),
        openQuantityQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.openQuantityQuote),
        ),
        oracleId: firstPosition.key.oracleId,
        positionCount: sortedPositions.length,
        positions: sortedPositions,
        realizedPnlQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.realizedPnlQuote),
        ),
        redeemedQuantityQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.redeemedQuantityQuote),
        ),
        strikes1e9: uniqueSortedBigints(sortedPositions.map((position) => position.key.strike1e9)),
        underlyingAsset: firstPosition.underlyingAsset,
        unrealizedPnlQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.unrealizedPnlQuote ?? 0n),
        ),
      };
    })
    .sort(comparePositionGroups);
}

function groupRangePositions(positions: RangePositionModel[]): RangePositionGroupModel[] {
  const groups = new Map<string, RangePositionModel[]>();

  for (const position of positions) {
    const groupKey = positionGroupKey(position.key.oracleId, position.key.expiryMs);
    const groupedPositions = groups.get(groupKey) ?? [];
    groupedPositions.push(position);
    groups.set(groupKey, groupedPositions);
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupedPositions]) => {
      const sortedPositions = [...groupedPositions].sort(compareRangePositions);
      const firstPosition = sortedPositions[0];

      return {
        expiryMs: firstPosition.key.expiryMs,
        groupKey,
        oracleId: firstPosition.key.oracleId,
        positionCount: sortedPositions.length,
        positions: sortedPositions,
        totalQuantityQuote: sumQuoteAmounts(
          sortedPositions.map((position) => position.quantityQuote),
        ),
      };
    })
    .sort(comparePositionGroups);
}

function positionGroupKey(oracleId: ObjectId, expiryMs: TimestampMs): string {
  return `${oracleId}:${expiryMs.toString()}`;
}

function sumQuoteAmounts(values: QuoteAmount[]): QuoteAmount {
  return values.reduce<QuoteAmount>((total, value) => total + value, 0n);
}

function sumOptionalQuoteAmounts(values: Array<QuoteAmount | undefined>): QuoteAmount | null {
  let hasValue = false;
  let total = 0n;

  for (const value of values) {
    if (value !== undefined) {
      hasValue = true;
      total += value;
    }
  }

  return hasValue ? total : null;
}

function maxTimestamp(values: TimestampMs[]): TimestampMs | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce<TimestampMs>((max, value) => (value > max ? value : max), values[0]);
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function uniqueSortedBigints(values: bigint[]): bigint[] {
  return Array.from(new Set(values)).sort((left, right) => compareBigint(left, right));
}

function compareBinaryPositions(
  left: BinaryPositionSummaryModel,
  right: BinaryPositionSummaryModel,
): number {
  return (
    compareBigint(left.key.strike1e9, right.key.strike1e9) ||
    left.key.direction.localeCompare(right.key.direction)
  );
}

function compareRangePositions(left: RangePositionModel, right: RangePositionModel): number {
  return (
    compareBigint(left.key.lowerStrike1e9, right.key.lowerStrike1e9) ||
    compareBigint(left.key.higherStrike1e9, right.key.higherStrike1e9)
  );
}

function comparePositionGroups(
  left: Pick<BinaryPositionGroupModel | RangePositionGroupModel, 'expiryMs' | 'oracleId'>,
  right: Pick<BinaryPositionGroupModel | RangePositionGroupModel, 'expiryMs' | 'oracleId'>,
): number {
  return (
    compareBigint(left.expiryMs, right.expiryMs) || left.oracleId.localeCompare(right.oracleId)
  );
}

function compareBigint(left: bigint, right: bigint): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
