import type { OracleLifecycleStatus, OracleStateModel } from '@/types/oracle';
import type { TimestampMs } from '@/types/predict';
import {
  analyzeDataFreshness,
  combineFreshnessStatus,
  getFreshnessSeverity,
  predictFreshnessPolicies,
  type DataFreshnessModel,
  type DataFreshnessSeverity,
  type DataFreshnessStatus,
  type FreshnessPolicy,
} from './freshness';

export type OracleExpiryStatus = 'OPEN' | 'EXPIRED';
export type OracleActionKind = 'MINT' | 'MINT_RANGE' | 'REDEEM' | 'REDEEM_RANGE';
export type OracleActionAvailabilityStatus = 'AVAILABLE' | 'WARNING' | 'BLOCKED';

export type OracleStatusReasonCode =
  | 'ORACLE_ACTIVE'
  | 'ORACLE_DELAYED'
  | 'ORACLE_EXPIRED'
  | 'ORACLE_INACTIVE'
  | 'ORACLE_PENDING_SETTLEMENT'
  | 'ORACLE_PRICE_MISSING'
  | 'ORACLE_SETTLED'
  | 'ORACLE_STALE'
  | 'ORACLE_SVI_MISSING'
  | 'SETTLED_REDEEM_AVAILABLE'
  | 'SETTLEMENT_PRICE_MISSING';

export interface OracleFreshnessBreakdown {
  aggregateStatus: DataFreshnessStatus;
  aggregateSeverity: DataFreshnessSeverity;
  price: DataFreshnessModel;
  svi: DataFreshnessModel;
}

export interface OracleActionAvailability {
  action: OracleActionKind;
  isAllowed: boolean;
  reasonCodes: OracleStatusReasonCode[];
  requiresAuthoritativeRefresh: boolean;
  severity: DataFreshnessSeverity;
  status: OracleActionAvailabilityStatus;
}

export interface OracleStatusModel {
  expiryStatus: OracleExpiryStatus;
  freshness: OracleFreshnessBreakdown;
  isExpired: boolean;
  isLive: boolean;
  lifecycleStatus: OracleLifecycleStatus;
  mint: OracleActionAvailability;
  mintRange: OracleActionAvailability;
  redeem: OracleActionAvailability;
  redeemRange: OracleActionAvailability;
}

export interface GetOracleStatusOptions {
  nowMs: TimestampMs | number;
  oracleState: OracleStateModel;
  pricePolicy?: FreshnessPolicy;
  sviPolicy?: FreshnessPolicy;
}

export function getOracleStatus({
  nowMs,
  oracleState,
  pricePolicy = predictFreshnessPolicies.oraclePrice,
  sviPolicy = predictFreshnessPolicies.oracleSvi,
}: GetOracleStatusOptions): OracleStatusModel {
  const freshness = getOracleFreshness({
    nowMs,
    oracleState,
    pricePolicy,
    sviPolicy,
  });
  const now = normalizeTimestamp(nowMs);
  const isExpired = now >= oracleState.oracle.expiryMs;
  const expiryStatus: OracleExpiryStatus = isExpired ? 'EXPIRED' : 'OPEN';
  const isLive = oracleState.oracle.lifecycleStatus === 'ACTIVE' && !isExpired;

  return {
    expiryStatus,
    freshness,
    isExpired,
    isLive,
    lifecycleStatus: oracleState.oracle.lifecycleStatus,
    mint: getMintAvailability({
      action: 'MINT',
      freshness,
      isExpired,
      oracleState,
    }),
    mintRange: getMintAvailability({
      action: 'MINT_RANGE',
      freshness,
      isExpired,
      oracleState,
    }),
    redeem: getRedeemAvailability({
      action: 'REDEEM',
      freshness,
      isExpired,
      oracleState,
    }),
    redeemRange: getRedeemAvailability({
      action: 'REDEEM_RANGE',
      freshness,
      isExpired,
      oracleState,
    }),
  };
}

export function getOracleFreshness({
  nowMs,
  oracleState,
  pricePolicy = predictFreshnessPolicies.oraclePrice,
  sviPolicy = predictFreshnessPolicies.oracleSvi,
}: GetOracleStatusOptions): OracleFreshnessBreakdown {
  const price = analyzeDataFreshness({
    lastUpdatedAtMs: oracleState.latestPrice?.onchainTimestampMs,
    nowMs,
    policy: pricePolicy,
  });
  const svi = analyzeDataFreshness({
    lastUpdatedAtMs: oracleState.latestSvi?.onchainTimestampMs,
    nowMs,
    policy: sviPolicy,
  });
  const aggregateStatus = combineFreshnessStatus([price.status, svi.status]);

  return {
    aggregateSeverity: getFreshnessSeverity(aggregateStatus),
    aggregateStatus,
    price,
    svi,
  };
}

function getMintAvailability({
  action,
  freshness,
  isExpired,
  oracleState,
}: {
  action: 'MINT' | 'MINT_RANGE';
  freshness: OracleFreshnessBreakdown;
  isExpired: boolean;
  oracleState: OracleStateModel;
}): OracleActionAvailability {
  const reasonCodes: OracleStatusReasonCode[] = [];

  addLifecycleBlockers(reasonCodes, oracleState.oracle.lifecycleStatus);

  if (isExpired) {
    reasonCodes.push('ORACLE_EXPIRED');
  }

  if (oracleState.latestPrice === null) {
    reasonCodes.push('ORACLE_PRICE_MISSING');
  }

  if (oracleState.latestSvi === null) {
    reasonCodes.push('ORACLE_SVI_MISSING');
  }

  if (freshness.aggregateStatus === 'STALE') {
    reasonCodes.push('ORACLE_STALE');
  }

  if (freshness.aggregateStatus === 'UNKNOWN' && reasonCodes.length === 0) {
    reasonCodes.push('ORACLE_STALE');
  }

  if (reasonCodes.length > 0) {
    return actionAvailability({
      action,
      isAllowed: false,
      reasonCodes,
      requiresAuthoritativeRefresh: freshness.aggregateStatus !== 'FRESH',
      severity: 'danger',
      status: 'BLOCKED',
    });
  }

  if (freshness.aggregateStatus === 'DELAYED') {
    return actionAvailability({
      action,
      isAllowed: true,
      reasonCodes: ['ORACLE_DELAYED'],
      requiresAuthoritativeRefresh: true,
      severity: 'warning',
      status: 'WARNING',
    });
  }

  return actionAvailability({
    action,
    isAllowed: true,
    reasonCodes: ['ORACLE_ACTIVE'],
    requiresAuthoritativeRefresh: false,
    severity: 'success',
    status: 'AVAILABLE',
  });
}

function getRedeemAvailability({
  action,
  freshness,
  isExpired,
  oracleState,
}: {
  action: 'REDEEM' | 'REDEEM_RANGE';
  freshness: OracleFreshnessBreakdown;
  isExpired: boolean;
  oracleState: OracleStateModel;
}): OracleActionAvailability {
  if (oracleState.oracle.lifecycleStatus === 'SETTLED') {
    if (oracleState.oracle.settlementPrice1e9 === null) {
      return blockedAction(action, ['SETTLEMENT_PRICE_MISSING'], false);
    }

    return actionAvailability({
      action,
      isAllowed: true,
      reasonCodes: ['SETTLED_REDEEM_AVAILABLE'],
      requiresAuthoritativeRefresh: false,
      severity: 'success',
      status: 'AVAILABLE',
    });
  }

  const reasonCodes: OracleStatusReasonCode[] = [];

  addLifecycleBlockers(reasonCodes, oracleState.oracle.lifecycleStatus);

  if (isExpired) {
    reasonCodes.push('ORACLE_EXPIRED');
  }

  if (oracleState.latestPrice === null) {
    reasonCodes.push('ORACLE_PRICE_MISSING');
  }

  if (oracleState.latestSvi === null) {
    reasonCodes.push('ORACLE_SVI_MISSING');
  }

  if (freshness.aggregateStatus === 'STALE') {
    reasonCodes.push('ORACLE_STALE');
  }

  if (freshness.aggregateStatus === 'UNKNOWN' && reasonCodes.length === 0) {
    reasonCodes.push('ORACLE_STALE');
  }

  if (reasonCodes.length > 0) {
    return blockedAction(action, reasonCodes, freshness.aggregateStatus !== 'FRESH');
  }

  if (freshness.aggregateStatus === 'DELAYED') {
    return actionAvailability({
      action,
      isAllowed: true,
      reasonCodes: ['ORACLE_DELAYED'],
      requiresAuthoritativeRefresh: true,
      severity: 'warning',
      status: 'WARNING',
    });
  }

  return actionAvailability({
    action,
    isAllowed: true,
    reasonCodes: ['ORACLE_ACTIVE'],
    requiresAuthoritativeRefresh: false,
    severity: 'success',
    status: 'AVAILABLE',
  });
}

function addLifecycleBlockers(reasonCodes: OracleStatusReasonCode[], lifecycleStatus: OracleLifecycleStatus) {
  switch (lifecycleStatus) {
    case 'ACTIVE':
      return;
    case 'INACTIVE':
      reasonCodes.push('ORACLE_INACTIVE');
      return;
    case 'PENDING_SETTLEMENT':
      reasonCodes.push('ORACLE_PENDING_SETTLEMENT');
      return;
    case 'SETTLED':
      reasonCodes.push('ORACLE_SETTLED');
      return;
  }
}

function blockedAction(
  action: OracleActionKind,
  reasonCodes: OracleStatusReasonCode[],
  requiresAuthoritativeRefresh: boolean,
) {
  return actionAvailability({
    action,
    isAllowed: false,
    reasonCodes,
    requiresAuthoritativeRefresh,
    severity: 'danger',
    status: 'BLOCKED',
  });
}

function actionAvailability(availability: OracleActionAvailability): OracleActionAvailability {
  return availability;
}

function normalizeTimestamp(timestampMs: TimestampMs | number): TimestampMs {
  return typeof timestampMs === 'bigint' ? timestampMs : BigInt(timestampMs);
}
