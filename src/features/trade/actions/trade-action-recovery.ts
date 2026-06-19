import {
  getPositionMintHistory,
  getPositionRedeemHistory,
  getRangeMintHistory,
  getRangeRedeemHistory,
  type HistoryReadClient,
} from '@/integrations/deepbook-predict/api/history';
import type { BinaryTradePreviewAction } from '@/integrations/deepbook-predict/tx/preview-binary';
import type { RangeTradePreviewAction } from '@/integrations/deepbook-predict/tx/preview-range';
import type {
  BinaryMintHistoryRecord,
  BinaryRedeemHistoryRecord,
  RangeMintHistoryRecord,
  RangeRedeemHistoryRecord,
} from '@/types/history';
import type { MarketKeyModel, RangeKeyModel, TransactionDigest } from '@/types/predict';
import type { PredictTransactionExecutionResult } from '@/types/tx';
import type { BinaryTradeTxPreviewBase } from './useBinaryTradeExecutionFlow';
import type { RangeTradeTxPreviewBase } from './useRangeTradeExecutionFlow';
import type { PredictSubmittedTransactionRecoveryResult } from './usePredictTradeExecutionFlow';

export interface TradeDigestRecoveryOptions<TPreview> {
  client?: HistoryReadClient;
  maxAttempts?: number;
  pollDelayMs?: number;
  preview: TPreview;
  requestedAtMs: number;
}

const DEFAULT_TRADE_RECOVERY_ATTEMPTS = 60;
const DEFAULT_TRADE_RECOVERY_POLL_DELAY_MS = 2_000;
const RECOVERY_TIMESTAMP_TOLERANCE_MS = 10_000n;

export async function recoverBinaryTradeDigest<TPreview extends BinaryTradeTxPreviewBase>({
  client,
  maxAttempts = DEFAULT_TRADE_RECOVERY_ATTEMPTS,
  pollDelayMs = DEFAULT_TRADE_RECOVERY_POLL_DELAY_MS,
  preview,
  requestedAtMs,
}: TradeDigestRecoveryOptions<TPreview>): Promise<PredictSubmittedTransactionRecoveryResult | null> {
  return recoverTradeDigest({
    findDigest: async () => {
      const records =
        preview.action === 'MINT'
          ? await getPositionMintHistory({ client })
          : await getPositionRedeemHistory({ client });
      return findLatestBinaryDigest(records, preview, requestedAtMs);
    },
    maxAttempts,
    pollDelayMs,
    preview,
  });
}

export async function recoverRangeTradeDigest<TPreview extends RangeTradeTxPreviewBase>({
  client,
  maxAttempts = DEFAULT_TRADE_RECOVERY_ATTEMPTS,
  pollDelayMs = DEFAULT_TRADE_RECOVERY_POLL_DELAY_MS,
  preview,
  requestedAtMs,
}: TradeDigestRecoveryOptions<TPreview>): Promise<PredictSubmittedTransactionRecoveryResult | null> {
  return recoverTradeDigest({
    findDigest: async () => {
      const records =
        preview.action === 'MINT_RANGE'
          ? await getRangeMintHistory({ client })
          : await getRangeRedeemHistory({ client });
      return findLatestRangeDigest(records, preview, requestedAtMs);
    },
    maxAttempts,
    pollDelayMs,
    preview,
  });
}

async function recoverTradeDigest<
  TPreview extends BinaryTradeTxPreviewBase | RangeTradeTxPreviewBase,
>({
  findDigest,
  maxAttempts,
  pollDelayMs,
  preview,
}: {
  findDigest: () => Promise<TransactionDigest | null>;
  maxAttempts: number;
  pollDelayMs: number;
  preview: TPreview;
}): Promise<PredictSubmittedTransactionRecoveryResult | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const digest = await findDigest();

    if (digest !== null) {
      return {
        affectedObjects: preview.affectedObjects,
        confirmedStatus: 'success' satisfies PredictTransactionExecutionResult['confirmedStatus'],
        description: createTradeRecoveryDescription(preview.action),
        digest,
      };
    }

    if (attempt < maxAttempts - 1) {
      await delay(pollDelayMs);
    }
  }

  return null;
}

function findLatestBinaryDigest(
  records: BinaryMintHistoryRecord[] | BinaryRedeemHistoryRecord[],
  preview: BinaryTradeTxPreviewBase,
  requestedAtMs: number,
): TransactionDigest | null {
  const matchingRecords = records.filter((record) =>
    isMatchingBinaryRecord(record, preview, requestedAtMs),
  );
  return newestDigest(matchingRecords);
}

function findLatestRangeDigest(
  records: RangeMintHistoryRecord[] | RangeRedeemHistoryRecord[],
  preview: RangeTradeTxPreviewBase,
  requestedAtMs: number,
): TransactionDigest | null {
  const matchingRecords = records.filter((record) =>
    isMatchingRangeRecord(record, preview, requestedAtMs),
  );
  return newestDigest(matchingRecords);
}

function isMatchingBinaryRecord(
  record: BinaryMintHistoryRecord | BinaryRedeemHistoryRecord,
  preview: BinaryTradeTxPreviewBase,
  requestedAtMs: number,
): boolean {
  return (
    isFreshEnough(record.timestampMs, requestedAtMs) &&
    record.managerId === preview.managerId &&
    record.quantityQuote === preview.quantityQuote &&
    isSameMarketKey(record.key, preview.marketKey) &&
    isRecordKindForBinaryAction(record.kind, preview.action)
  );
}

function isMatchingRangeRecord(
  record: RangeMintHistoryRecord | RangeRedeemHistoryRecord,
  preview: RangeTradeTxPreviewBase,
  requestedAtMs: number,
): boolean {
  return (
    isFreshEnough(record.timestampMs, requestedAtMs) &&
    record.managerId === preview.managerId &&
    record.quantityQuote === preview.quantityQuote &&
    isSameRangeKey(record.key, preview.rangeKey) &&
    isRecordKindForRangeAction(record.kind, preview.action)
  );
}

function newestDigest<
  TRecord extends {
    digest: TransactionDigest;
    eventIndex?: number;
    timestampMs: bigint;
    txIndex?: number;
  },
>(records: TRecord[]): TransactionDigest | null {
  const newest = [...records].sort((left, right) => {
    if (left.timestampMs !== right.timestampMs) {
      return left.timestampMs > right.timestampMs ? -1 : 1;
    }

    const txDelta = (right.txIndex ?? 0) - (left.txIndex ?? 0);
    if (txDelta !== 0) {
      return txDelta;
    }

    return (right.eventIndex ?? 0) - (left.eventIndex ?? 0);
  })[0];

  return newest?.digest ?? null;
}

function isFreshEnough(timestampMs: bigint, requestedAtMs: number): boolean {
  return timestampMs + RECOVERY_TIMESTAMP_TOLERANCE_MS >= BigInt(requestedAtMs);
}

function isRecordKindForBinaryAction(
  kind: BinaryMintHistoryRecord['kind'] | BinaryRedeemHistoryRecord['kind'],
  action: BinaryTradePreviewAction,
): boolean {
  return (
    (action === 'MINT' && kind === 'BINARY_MINT') ||
    (action === 'REDEEM' && kind === 'BINARY_REDEEM')
  );
}

function isRecordKindForRangeAction(
  kind: RangeMintHistoryRecord['kind'] | RangeRedeemHistoryRecord['kind'],
  action: RangeTradePreviewAction,
): boolean {
  return (
    (action === 'MINT_RANGE' && kind === 'RANGE_MINT') ||
    (action === 'REDEEM_RANGE' && kind === 'RANGE_REDEEM')
  );
}

function isSameMarketKey(left: MarketKeyModel, right: MarketKeyModel): boolean {
  return (
    left.oracleId === right.oracleId &&
    left.expiryMs === right.expiryMs &&
    left.strike1e9 === right.strike1e9 &&
    left.direction === right.direction
  );
}

function isSameRangeKey(left: RangeKeyModel, right: RangeKeyModel): boolean {
  return (
    left.oracleId === right.oracleId &&
    left.expiryMs === right.expiryMs &&
    left.lowerStrike1e9 === right.lowerStrike1e9 &&
    left.higherStrike1e9 === right.higherStrike1e9
  );
}

function createTradeRecoveryDescription(
  action: BinaryTradePreviewAction | RangeTradePreviewAction,
): string {
  switch (action) {
    case 'MINT':
      return 'Recovered confirmed binary mint digest from Predict server mint history after wallet handoff.';
    case 'REDEEM':
      return 'Recovered confirmed binary redeem digest from Predict server redeem history after wallet handoff.';
    case 'MINT_RANGE':
      return 'Recovered confirmed range mint digest from Predict server range mint history after wallet handoff.';
    case 'REDEEM_RANGE':
      return 'Recovered confirmed range redeem digest from Predict server range redeem history after wallet handoff.';
  }
}

async function delay(delayMs: number) {
  if (delayMs <= 0) {
    await Promise.resolve();
    return;
  }

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    await new Promise<void>((resolve) => {
      timeoutId = globalThis.setTimeout(resolve, delayMs);
    });
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
