import { buildBinaryMarketKey, buildRangeKey } from '@/features/markets/lib/market-keys';
import { getOracleStatus } from '@/lib/oracle-status';
import type { DataFreshnessStatus } from '@/lib/freshness';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { BinaryDirection, TimestampMs } from '@/types/predict';
import type { StrikeInput } from '@/features/markets/lib/market-keys';

export type OracleHealthAuditStatus = 'BLOCKED' | 'CAUTION' | 'HEALTHY' | 'UNKNOWN';
export type OracleHealthAuditCheckStatus = 'blocked' | 'caution' | 'pass' | 'unknown';
export type OracleHealthAuditSource = 'Live polling' | 'Local validation' | 'Predict server';

export type OracleHealthAuditSelection =
  | {
      direction: BinaryDirection;
      kind: 'binary';
      strike1e9: StrikeInput;
    }
  | {
      higherStrike1e9: StrikeInput;
      kind: 'range';
      lowerStrike1e9: StrikeInput;
    };

export interface OracleHealthAuditCheck {
  detail: string;
  label: string;
  source: OracleHealthAuditSource;
  status: OracleHealthAuditCheckStatus;
}

export interface OracleHealthAuditModel {
  checks: OracleHealthAuditCheck[];
  description: string;
  sourceLabels: OracleHealthAuditSource[];
  status: OracleHealthAuditStatus;
  title: string;
}

export interface CreateOracleHealthAuditOptions {
  askBounds?: OracleAskBoundsModel;
  nowMs: TimestampMs | number;
  oracleState?: OracleStateModel | null;
  selection?: OracleHealthAuditSelection;
  stateSource?: OracleHealthAuditSource;
}

const nearExpiryWindowMs = 20n * 60n * 1_000n;

export function createOracleHealthAudit({
  askBounds,
  nowMs,
  oracleState,
  selection,
  stateSource = 'Predict server',
}: CreateOracleHealthAuditOptions): OracleHealthAuditModel {
  if (oracleState === null || oracleState === undefined) {
    return createUnknownAudit();
  }

  const normalizedNowMs = normalizeTimestampMs(nowMs);
  const status = getOracleStatus({ nowMs: normalizedNowMs, oracleState });
  const effectiveAskBounds = askBounds ?? oracleState.askBounds;
  const checks: OracleHealthAuditCheck[] = [
    lifecycleCheck(oracleState, stateSource),
    expiryCheck({ nowMs: normalizedNowMs, oracleState, source: stateSource }),
    freshnessCheck({
      label: 'Price freshness',
      source: stateSource,
      status: status.freshness.price.status,
    }),
    freshnessCheck({
      label: 'SVI freshness',
      source: stateSource,
      status: status.freshness.svi.status,
    }),
    askBoundsCheck(effectiveAskBounds),
  ];

  if (selection !== undefined) {
    checks.push(selectionCheck({ askBounds: effectiveAskBounds, oracleState, selection }));
  }

  return createAuditFromChecks(checks);
}

function createUnknownAudit(): OracleHealthAuditModel {
  return {
    checks: [
      {
        detail:
          'Oracle state is missing, so PredictPilot cannot audit lifecycle, freshness, or trade selection.',
        label: 'Oracle state',
        source: 'Predict server',
        status: 'unknown',
      },
    ],
    description: 'Predict server data is missing or unavailable. Status not verified.',
    sourceLabels: ['Predict server'],
    status: 'UNKNOWN',
    title: 'Audit unavailable',
  };
}

function createAuditFromChecks(checks: OracleHealthAuditCheck[]): OracleHealthAuditModel {
  const status = getOverallStatus(checks);

  return {
    checks,
    description: descriptionForStatus(status),
    sourceLabels: dedupeSources(checks.map((check) => check.source)),
    status,
    title: titleForStatus(status),
  };
}

function lifecycleCheck(
  oracleState: OracleStateModel,
  source: OracleHealthAuditSource,
): OracleHealthAuditCheck {
  switch (oracleState.oracle.lifecycleStatus) {
    case 'ACTIVE':
      return {
        detail:
          'Oracle is active and can be considered for mint previews while expiry remains open.',
        label: 'Lifecycle',
        source,
        status: 'pass',
      };
    case 'INACTIVE':
      return {
        detail: 'Inactive oracle is not live for mint flows.',
        label: 'Lifecycle',
        source,
        status: 'blocked',
      };
    case 'PENDING_SETTLEMENT':
      return {
        detail: 'Market has reached the settlement boundary and is not a safe live mint candidate.',
        label: 'Lifecycle',
        source,
        status: 'blocked',
      };
    case 'SETTLED':
      return {
        detail: 'Settled oracle blocks new mint demos; only compatible redeem context may apply.',
        label: 'Lifecycle',
        source,
        status: 'blocked',
      };
  }
}

function expiryCheck({
  nowMs,
  oracleState,
  source,
}: {
  nowMs: bigint;
  oracleState: OracleStateModel;
  source: OracleHealthAuditSource;
}): OracleHealthAuditCheck {
  const remainingMs = oracleState.oracle.expiryMs - nowMs;

  if (remainingMs <= 0n) {
    return {
      detail: 'Expiry has passed. Do not use this oracle for a live mint demo.',
      label: 'Expiry',
      source,
      status: 'blocked',
    };
  }

  if (remainingMs <= nearExpiryWindowMs) {
    return {
      detail:
        'Expiry is near. A live demo could cross into settlement while the user is reviewing.',
      label: 'Expiry',
      source,
      status: 'caution',
    };
  }

  return {
    detail: 'Expiry remains open beyond the near-expiry demo window.',
    label: 'Expiry',
    source,
    status: 'pass',
  };
}

function freshnessCheck({
  label,
  source,
  status,
}: {
  label: string;
  source: OracleHealthAuditSource;
  status: DataFreshnessStatus;
}): OracleHealthAuditCheck {
  switch (status) {
    case 'FRESH':
      return {
        detail: `${label} is within the configured freshness window.`,
        label,
        source,
        status: 'pass',
      };
    case 'DELAYED':
      return {
        detail: `${label} is aging. Refresh or simulation should confirm state before signing.`,
        label,
        source,
        status: 'caution',
      };
    case 'STALE':
      return {
        detail: `${label} is stale under the configured freshness policy.`,
        label,
        source,
        status: 'blocked',
      };
    case 'UNKNOWN':
      return {
        detail: `${label} timestamp is missing, so tradeability cannot be audited.`,
        label,
        source,
        status: 'blocked',
      };
  }
}

function askBoundsCheck(askBounds: OracleAskBoundsModel | undefined): OracleHealthAuditCheck {
  if (askBounds === undefined || askBounds.status === 'UNAVAILABLE') {
    return {
      detail:
        'Ask bounds are unavailable. Mint preview may still work, but bounds were not confirmed.',
      label: 'Ask bounds',
      source: 'Predict server',
      status: 'caution',
    };
  }

  return {
    detail: 'Ask bounds are present, but exact lower/upper server fields remain TODO VERIFY.',
    label: 'Ask bounds',
    source: 'Predict server',
    status: 'caution',
  };
}

function selectionCheck({
  askBounds,
  oracleState,
  selection,
}: {
  askBounds: OracleAskBoundsModel | undefined;
  oracleState: OracleStateModel;
  selection: OracleHealthAuditSelection;
}): OracleHealthAuditCheck {
  if (selection.kind === 'binary') {
    const result = buildBinaryMarketKey({
      askBounds,
      direction: selection.direction,
      oracle: oracleState.oracle,
      strike1e9: selection.strike1e9,
    });

    if (!result.ok) {
      return {
        detail: result.errors.map((error) => error.message).join(' '),
        label: 'Binary strike',
        source: 'Local validation',
        status: 'blocked',
      };
    }

    return {
      detail: 'Selected binary strike matches the oracle minimum and tick-size grid.',
      label: 'Binary strike',
      source: 'Local validation',
      status: 'pass',
    };
  }

  const result = buildRangeKey({
    askBounds,
    higherStrike1e9: selection.higherStrike1e9,
    lowerStrike1e9: selection.lowerStrike1e9,
    oracle: oracleState.oracle,
  });

  if (!result.ok) {
    return {
      detail: result.errors.map((error) => error.message).join(' '),
      label: 'Range strikes',
      source: 'Local validation',
      status: 'blocked',
    };
  }

  return {
    detail: 'Selected range satisfies strike-grid alignment and lower < higher.',
    label: 'Range strikes',
    source: 'Local validation',
    status: 'pass',
  };
}

function getOverallStatus(checks: OracleHealthAuditCheck[]): OracleHealthAuditStatus {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'BLOCKED';
  }

  if (checks.some((check) => check.status === 'unknown')) {
    return 'UNKNOWN';
  }

  if (checks.some((check) => check.status === 'caution')) {
    return 'CAUTION';
  }

  return 'HEALTHY';
}

function titleForStatus(status: OracleHealthAuditStatus) {
  switch (status) {
    case 'HEALTHY':
      return 'Demo-ready oracle';
    case 'CAUTION':
      return 'Use with caution';
    case 'BLOCKED':
      return 'Do not use for live mint';
    case 'UNKNOWN':
      return 'Audit unavailable';
  }
}

function descriptionForStatus(status: OracleHealthAuditStatus) {
  switch (status) {
    case 'HEALTHY':
      return 'Active market, acceptable freshness, mapped bounds, and valid selected trade inputs.';
    case 'CAUTION':
      return 'The oracle may still be usable, but freshness, expiry timing, or bounds data could make a live demo unreliable.';
    case 'BLOCKED':
      return 'This oracle or selected trade shape should not be used for a live mint demo.';
    case 'UNKNOWN':
      return 'Predict server data is missing or changed shape. Status not verified.';
  }
}

function dedupeSources(sources: OracleHealthAuditSource[]) {
  return Array.from(new Set(sources));
}

function normalizeTimestampMs(nowMs: TimestampMs | number): TimestampMs {
  return typeof nowMs === 'bigint' ? nowMs : BigInt(nowMs);
}
