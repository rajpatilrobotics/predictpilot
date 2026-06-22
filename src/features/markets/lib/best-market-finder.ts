import { buildBinaryMarketKey, buildRangeKey } from '@/features/markets/lib/market-keys';
import type { OracleAskBoundsModel, OracleStateModel, OracleSummaryModel } from '@/types/oracle';
import type { ObjectId, TimestampMs } from '@/types/predict';

export type BestDemoMarketReasonCode =
  | 'ACTIVE_ORACLE'
  | 'ASK_BOUNDS_PRESENT'
  | 'BTC_FAMILIAR'
  | 'DEMO_EXPIRY'
  | 'FRESH_ORACLE'
  | 'MANAGER_READY'
  | 'STRATEGY_VALID'
  | 'TESTNET_READY'
  | 'WALLET_READY';

export type BestDemoMarketWarningCode =
  | 'ASK_BOUNDS_UNAVAILABLE'
  | 'ASK_BOUNDS_UNMAPPED'
  | 'DUSDC_NEEDED'
  | 'EXPIRING_SOON'
  | 'EXPIRY_LONG'
  | 'FRESHNESS_UNKNOWN'
  | 'INACTIVE_ORACLE'
  | 'MANAGER_NEEDED'
  | 'MISSING_TIMESTAMP'
  | 'STALE_ORACLE'
  | 'STRATEGY_UNAVAILABLE'
  | 'WALLET_NOT_CONNECTED'
  | 'WRONG_NETWORK';

export interface BestDemoMarketLabel {
  code: BestDemoMarketReasonCode | BestDemoMarketWarningCode;
  label: string;
}

export interface BestDemoMarketReadiness {
  hasManagerDusdc: boolean;
  isManagerReady: boolean;
  isWalletConnected: boolean;
  isWalletOnTestnet: boolean;
}

export interface BestDemoMarketEnrichment {
  askBounds?: OracleAskBoundsModel;
  oracleState?: OracleStateModel;
}

export interface BestDemoMarketCandidate {
  auditHref: string;
  expiryDistanceMs: bigint;
  isEligibleForTopRecommendation: boolean;
  marketQualityScore: number;
  oracle: OracleSummaryModel;
  oracleId: ObjectId;
  readinessScore: number;
  reasons: BestDemoMarketLabel[];
  recommendationLabel:
    | 'Blocked for live demo'
    | 'Recommended for live demo'
    | 'Recommended with warnings';
  strategyHref: string;
  totalScore: number;
  warnings: BestDemoMarketLabel[];
}

export interface RankBestDemoMarketsOptions {
  enrichments?: ReadonlyMap<ObjectId, BestDemoMarketEnrichment>;
  nowMs: TimestampMs | number;
  oracles: OracleSummaryModel[];
  readiness: BestDemoMarketReadiness;
}

const minuteMs = 60_000n;
const hourMs = 60n * minuteMs;
const freshnessFullMs = 60n * 1_000n;
const freshnessPartialMs = 600n * 1_000n;
const minimumCalmDemoWindowMs = 20n * minuteMs;
const idealExpiryMinMs = 2n * hourMs;
const idealExpiryMaxMs = 72n * hourMs;
const marketQualityTieWindow = 5;

export function rankBestDemoMarkets({
  enrichments = new Map(),
  nowMs,
  oracles,
  readiness,
}: RankBestDemoMarketsOptions): BestDemoMarketCandidate[] {
  const now = normalizeTimestampMs(nowMs);

  return oracles
    .map((oracle) =>
      scoreMarket({ enrichment: enrichments.get(oracle.oracleId), now, oracle, readiness }),
    )
    .sort((left, right) => compareBestDemoMarketCandidates(left, right));
}

export function getTopBestDemoMarket(
  candidates: readonly BestDemoMarketCandidate[],
): BestDemoMarketCandidate | null {
  return candidates.find((candidate) => candidate.isEligibleForTopRecommendation) ?? null;
}

function scoreMarket({
  enrichment,
  now,
  oracle,
  readiness,
}: {
  enrichment: BestDemoMarketEnrichment | undefined;
  now: bigint;
  oracle: OracleSummaryModel;
  readiness: BestDemoMarketReadiness;
}): BestDemoMarketCandidate {
  const reasons: BestDemoMarketLabel[] = [];
  const warnings: BestDemoMarketLabel[] = [];
  let marketQualityScore = 0;
  let isEligibleForTopRecommendation = true;

  if (oracle.lifecycleStatus === 'ACTIVE') {
    marketQualityScore += 25;
    reasons.push(reason('ACTIVE_ORACLE'));
  } else {
    isEligibleForTopRecommendation = false;
    warnings.push(warning('INACTIVE_ORACLE'));
  }

  const expiryDistanceMs = oracle.expiryMs - now;
  const expiryScore = scoreExpiryWindow(expiryDistanceMs);
  marketQualityScore += expiryScore.score;
  if (expiryScore.reason !== null) {
    reasons.push(reason(expiryScore.reason));
  }
  if (expiryScore.warning !== null) {
    warnings.push(warning(expiryScore.warning));
  }
  if (expiryScore.blocksTopRecommendation) {
    isEligibleForTopRecommendation = false;
  }

  const strategyScore = scoreStrategyValidity(oracle);
  marketQualityScore += strategyScore.score;
  if (strategyScore.valid) {
    reasons.push(reason('STRATEGY_VALID'));
  } else {
    isEligibleForTopRecommendation = false;
    warnings.push(warning('STRATEGY_UNAVAILABLE'));
  }

  const freshnessScore = scoreFreshness({ enrichment, now });
  marketQualityScore += freshnessScore.score;
  if (freshnessScore.reason !== null) {
    reasons.push(reason(freshnessScore.reason));
  }
  for (const freshnessWarning of freshnessScore.warnings) {
    warnings.push(warning(freshnessWarning));
  }
  if (freshnessScore.blocksTopRecommendation) {
    isEligibleForTopRecommendation = false;
  }

  const askBoundsScore = scoreAskBounds(enrichment?.askBounds);
  marketQualityScore += askBoundsScore.score;
  if (askBoundsScore.reason !== null) {
    reasons.push(reason(askBoundsScore.reason));
  }
  if (askBoundsScore.warning !== null) {
    warnings.push(warning(askBoundsScore.warning));
  }

  if (oracle.underlyingAsset.toUpperCase() === 'BTC') {
    marketQualityScore += 5;
    reasons.push(reason('BTC_FAMILIAR'));
  }

  const readinessScore = scoreReadiness({ readiness, reasons, warnings });
  const totalScore = marketQualityScore + readinessScore;

  return {
    auditHref: `/oracle-status?oracleId=${oracle.oracleId}&source=best-market-finder`,
    expiryDistanceMs,
    isEligibleForTopRecommendation,
    marketQualityScore,
    oracle,
    oracleId: oracle.oracleId,
    readinessScore,
    reasons: dedupeLabels(reasons),
    recommendationLabel: getRecommendationLabel({ isEligibleForTopRecommendation, warnings }),
    strategyHref: `/markets/${oracle.oracleId}?source=best-market-finder`,
    totalScore,
    warnings: dedupeLabels(warnings),
  };
}

function scoreExpiryWindow(expiryDistanceMs: bigint): {
  blocksTopRecommendation: boolean;
  reason: BestDemoMarketReasonCode | null;
  score: number;
  warning: BestDemoMarketWarningCode | null;
} {
  if (expiryDistanceMs <= 0n) {
    return {
      blocksTopRecommendation: true,
      reason: null,
      score: 0,
      warning: 'EXPIRING_SOON',
    };
  }

  if (expiryDistanceMs <= minimumCalmDemoWindowMs) {
    return {
      blocksTopRecommendation: true,
      reason: null,
      score: 0,
      warning: 'EXPIRING_SOON',
    };
  }

  if (expiryDistanceMs < idealExpiryMinMs) {
    return {
      blocksTopRecommendation: false,
      reason: null,
      score: 8,
      warning: 'EXPIRING_SOON',
    };
  }

  if (expiryDistanceMs <= idealExpiryMaxMs) {
    return {
      blocksTopRecommendation: false,
      reason: 'DEMO_EXPIRY',
      score: 15,
      warning: null,
    };
  }

  return {
    blocksTopRecommendation: false,
    reason: null,
    score: 7,
    warning: 'EXPIRY_LONG',
  };
}

function scoreStrategyValidity(oracle: OracleSummaryModel): { score: number; valid: boolean } {
  const binaryKey = buildBinaryMarketKey({
    direction: 'UP',
    oracle,
    strike1e9: oracle.minStrike1e9,
  });
  const rangeKey = buildRangeKey({
    higherStrike1e9: oracle.minStrike1e9 + oracle.tickSize1e9,
    lowerStrike1e9: oracle.minStrike1e9,
    oracle,
  });
  const valid = binaryKey.ok || rangeKey.ok;

  return {
    score: valid ? 20 : 0,
    valid,
  };
}

function scoreFreshness({
  enrichment,
  now,
}: {
  enrichment: BestDemoMarketEnrichment | undefined;
  now: bigint;
}): {
  blocksTopRecommendation: boolean;
  reason: BestDemoMarketReasonCode | null;
  score: number;
  warnings: BestDemoMarketWarningCode[];
} {
  if (enrichment?.oracleState === undefined) {
    return {
      blocksTopRecommendation: false,
      reason: null,
      score: 8,
      warnings: ['FRESHNESS_UNKNOWN'],
    };
  }

  const priceTimestamp = enrichment.oracleState.latestPrice?.onchainTimestampMs;
  const sviTimestamp = enrichment.oracleState.latestSvi?.onchainTimestampMs;

  if (priceTimestamp === undefined || sviTimestamp === undefined) {
    return {
      blocksTopRecommendation: true,
      reason: null,
      score: 0,
      warnings: ['MISSING_TIMESTAMP'],
    };
  }

  const ageMs = maxBigint(now - priceTimestamp, now - sviTimestamp);

  if (ageMs <= freshnessFullMs) {
    return {
      blocksTopRecommendation: false,
      reason: 'FRESH_ORACLE',
      score: 20,
      warnings: [],
    };
  }

  if (ageMs <= freshnessPartialMs) {
    return {
      blocksTopRecommendation: false,
      reason: null,
      score: 6,
      warnings: ['FRESHNESS_UNKNOWN'],
    };
  }

  return {
    blocksTopRecommendation: true,
    reason: null,
    score: 0,
    warnings: ['STALE_ORACLE'],
  };
}

function scoreAskBounds(askBounds: OracleAskBoundsModel | undefined): {
  reason: BestDemoMarketReasonCode | null;
  score: number;
  warning: BestDemoMarketWarningCode | null;
} {
  if (askBounds === undefined) {
    return {
      reason: null,
      score: 0,
      warning: 'ASK_BOUNDS_UNAVAILABLE',
    };
  }

  if (askBounds.status === 'PRESENT_UNMAPPED') {
    return {
      reason: 'ASK_BOUNDS_PRESENT',
      score: 5,
      warning: 'ASK_BOUNDS_UNMAPPED',
    };
  }

  return {
    reason: null,
    score: 0,
    warning: 'ASK_BOUNDS_UNAVAILABLE',
  };
}

function scoreReadiness({
  readiness,
  reasons,
  warnings,
}: {
  readiness: BestDemoMarketReadiness;
  reasons: BestDemoMarketLabel[];
  warnings: BestDemoMarketLabel[];
}): number {
  let readinessScore = 0;

  if (readiness.isWalletConnected) {
    readinessScore += 6;
    reasons.push(reason('WALLET_READY'));
  } else {
    warnings.push(warning('WALLET_NOT_CONNECTED'));
  }

  if (readiness.isWalletOnTestnet) {
    readinessScore += 4;
    reasons.push(reason('TESTNET_READY'));
  } else if (readiness.isWalletConnected) {
    warnings.push(warning('WRONG_NETWORK'));
  }

  if (readiness.isManagerReady) {
    readinessScore += 4;
    reasons.push(reason('MANAGER_READY'));
  } else {
    warnings.push(warning('MANAGER_NEEDED'));
  }

  if (readiness.hasManagerDusdc) {
    readinessScore += 6;
  } else {
    warnings.push(warning('DUSDC_NEEDED'));
  }

  return readinessScore;
}

function compareBestDemoMarketCandidates(
  left: BestDemoMarketCandidate,
  right: BestDemoMarketCandidate,
): number {
  if (left.isEligibleForTopRecommendation !== right.isEligibleForTopRecommendation) {
    return left.isEligibleForTopRecommendation ? -1 : 1;
  }

  const qualityDelta = right.marketQualityScore - left.marketQualityScore;
  if (Math.abs(qualityDelta) > marketQualityTieWindow) {
    return qualityDelta;
  }

  const readinessDelta = right.readinessScore - left.readinessScore;
  if (readinessDelta !== 0) {
    return readinessDelta;
  }

  const expiryWindowDelta = compareExpiryWindowQuality(
    left.expiryDistanceMs,
    right.expiryDistanceMs,
  );
  if (expiryWindowDelta !== 0) {
    return expiryWindowDelta;
  }

  return left.oracleId.localeCompare(right.oracleId);
}

function compareExpiryWindowQuality(leftMs: bigint, rightMs: bigint): number {
  const leftDistance = expiryWindowDistanceFromIdeal(leftMs);
  const rightDistance = expiryWindowDistanceFromIdeal(rightMs);

  if (leftDistance < rightDistance) {
    return -1;
  }

  if (leftDistance > rightDistance) {
    return 1;
  }

  return 0;
}

function expiryWindowDistanceFromIdeal(expiryDistanceMs: bigint): bigint {
  if (expiryDistanceMs >= idealExpiryMinMs && expiryDistanceMs <= idealExpiryMaxMs) {
    return 0n;
  }

  if (expiryDistanceMs < idealExpiryMinMs) {
    return idealExpiryMinMs - expiryDistanceMs;
  }

  return expiryDistanceMs - idealExpiryMaxMs;
}

function getRecommendationLabel({
  isEligibleForTopRecommendation,
  warnings,
}: {
  isEligibleForTopRecommendation: boolean;
  warnings: BestDemoMarketLabel[];
}): BestDemoMarketCandidate['recommendationLabel'] {
  if (!isEligibleForTopRecommendation) {
    return 'Blocked for live demo';
  }

  return warnings.length > 0 ? 'Recommended with warnings' : 'Recommended for live demo';
}

function reason(code: BestDemoMarketReasonCode): BestDemoMarketLabel {
  return { code, label: reasonLabels[code] };
}

function warning(code: BestDemoMarketWarningCode): BestDemoMarketLabel {
  return { code, label: warningLabels[code] };
}

function dedupeLabels(labels: BestDemoMarketLabel[]): BestDemoMarketLabel[] {
  const seen = new Set<string>();

  return labels.filter((label) => {
    if (seen.has(label.code)) {
      return false;
    }

    seen.add(label.code);
    return true;
  });
}

function normalizeTimestampMs(value: TimestampMs | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function maxBigint(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

const reasonLabels = {
  ACTIVE_ORACLE: 'Active oracle',
  ASK_BOUNDS_PRESENT: 'Ask bounds present',
  BTC_FAMILIAR: 'BTC familiar',
  DEMO_EXPIRY: 'Good demo expiry',
  FRESH_ORACLE: 'Fresh oracle',
  MANAGER_READY: 'Manager ready',
  STRATEGY_VALID: 'Valid strategy path',
  TESTNET_READY: 'Testnet ready',
  WALLET_READY: 'Wallet ready',
} as const satisfies Record<BestDemoMarketReasonCode, string>;

const warningLabels = {
  ASK_BOUNDS_UNAVAILABLE: 'Ask bounds unavailable',
  ASK_BOUNDS_UNMAPPED: 'Ask bounds need audit',
  DUSDC_NEEDED: 'Fund dUSDC',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRY_LONG: 'Long-dated market',
  FRESHNESS_UNKNOWN: 'Freshness unknown',
  INACTIVE_ORACLE: 'Inactive oracle',
  MANAGER_NEEDED: 'Manager needed',
  MISSING_TIMESTAMP: 'Missing oracle timestamp',
  STALE_ORACLE: 'Stale oracle',
  STRATEGY_UNAVAILABLE: 'Strategy unavailable',
  WALLET_NOT_CONNECTED: 'Wallet not connected',
  WRONG_NETWORK: 'Wrong network',
} as const satisfies Record<BestDemoMarketWarningCode, string>;
