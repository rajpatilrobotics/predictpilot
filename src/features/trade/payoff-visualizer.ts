import { predictDeploymentConfig } from '@/config/predict';
import type { BinaryTradePreviewModel } from '@/integrations/deepbook-predict/tx/preview-binary';
import type { RangeTradePreviewModel } from '@/integrations/deepbook-predict/tx/preview-range';
import type { OracleStatusModel } from '@/lib/oracle-status';
import { formatPrice1e9, formatQuoteAmount, formatSafeIsoTimestamp } from '@/lib/formatters';
import type { BinaryDirection, MarketKeyModel, QuoteAmount } from '@/types/predict';

export type PayoffVisualizerKind = 'binary' | 'range';
export type PayoffVisualizerWarningLevel = 'blocked' | 'caution';

export interface PayoffVisualizerWarning {
  code: string;
  level: PayoffVisualizerWarningLevel;
  message: string;
}

export interface PayoffVisualizerFact {
  label: string;
  value: string;
}

export interface PayoffVisualizerModel {
  action: string;
  estimateLabel: string;
  estimateValue: string;
  facts: PayoffVisualizerFact[];
  kind: PayoffVisualizerKind;
  lossCondition: string;
  title: string;
  warnings: PayoffVisualizerWarning[];
  winCondition: string;
}

export interface PayoffVisualizerSnapshot {
  action: string;
  direction?: BinaryDirection;
  estimatedCostQuote?: QuoteAmount;
  estimatedPayoutQuote?: QuoteAmount;
  expiryMs?: bigint | number;
  higherStrike1e9?: bigint;
  kind: PayoffVisualizerKind;
  lowerStrike1e9?: bigint;
  managerBalanceQuote?: QuoteAmount;
  managerId?: string;
  oracleFreshness?: string;
  oracleId?: string;
  oracleStatus?: string;
  quantityQuote?: QuoteAmount;
  quoteAssetSymbol?: string;
  strike1e9?: bigint;
  underlyingAsset?: string;
  warnings?: PayoffVisualizerWarning[];
}

export interface PayoffValidationIssue {
  code: string;
  message: string;
}

export interface CreateDraftPayoffVisualizerModelOptions {
  action: string;
  direction?: BinaryDirection;
  expiryMs: bigint | number;
  higherStrike1e9?: bigint;
  kind: PayoffVisualizerKind;
  lowerStrike1e9?: bigint;
  managerBalanceQuote?: QuoteAmount;
  managerId?: string | null;
  oracleFreshness?: string;
  oracleId: string;
  oracleStatus?: string;
  quantityQuote?: QuoteAmount | null;
  strike1e9?: bigint;
  underlyingAsset: string;
  validationErrors?: PayoffValidationIssue[];
  validationWarnings?: PayoffValidationIssue[];
}

export type PayoffPreviewLike =
  | BinaryTradePreviewModel
  | RangeTradePreviewModel
  | {
      action?: string;
      blockers?: string[];
      direction?: BinaryDirection;
      estimatedCostQuote?: QuoteAmount;
      estimatedPayoutQuote?: QuoteAmount;
      expiryMs?: bigint | number;
      higherStrike1e9?: bigint;
      lowerStrike1e9?: bigint;
      managerBalanceQuote?: QuoteAmount;
      managerId?: string;
      oracleFreshness?: string;
      oracleId?: string;
      oracleStatus?: OracleStatusModel | string;
      payoffKind?: PayoffVisualizerKind;
      quantityQuote?: QuoteAmount;
      quoteAsset?: {
        symbol: string;
      };
      strike1e9?: bigint;
      underlyingAsset?: string;
      warnings?: Array<string | { code?: string; message: string; severity?: string }>;
    };

export function createDraftPayoffVisualizerModel({
  action,
  direction,
  expiryMs,
  higherStrike1e9,
  kind,
  lowerStrike1e9,
  managerBalanceQuote,
  managerId,
  oracleFreshness,
  oracleId,
  oracleStatus,
  quantityQuote,
  strike1e9,
  underlyingAsset,
  validationErrors = [],
  validationWarnings = [],
}: CreateDraftPayoffVisualizerModelOptions): PayoffVisualizerModel {
  return createPayoffVisualizerModelFromSnapshot(
    createDraftPayoffVisualizerSnapshot({
      action,
      direction,
      expiryMs,
      higherStrike1e9,
      kind,
      lowerStrike1e9,
      managerBalanceQuote,
      managerId,
      oracleFreshness,
      oracleId,
      oracleStatus,
      quantityQuote,
      strike1e9,
      underlyingAsset,
      validationErrors,
      validationWarnings,
    }),
  );
}

export function createDraftPayoffVisualizerSnapshot({
  action,
  direction,
  expiryMs,
  higherStrike1e9,
  kind,
  lowerStrike1e9,
  managerBalanceQuote,
  managerId,
  oracleFreshness,
  oracleId,
  oracleStatus,
  quantityQuote,
  strike1e9,
  underlyingAsset,
  validationErrors = [],
  validationWarnings = [],
}: CreateDraftPayoffVisualizerModelOptions): PayoffVisualizerSnapshot {
  const quoteSymbol = predictDeploymentConfig.quoteAsset.symbol;

  return {
    action,
    direction,
    expiryMs,
    higherStrike1e9,
    kind,
    lowerStrike1e9,
    managerBalanceQuote,
    managerId: managerId ?? undefined,
    oracleFreshness,
    oracleId,
    oracleStatus,
    quantityQuote: quantityQuote ?? undefined,
    quoteAssetSymbol: quoteSymbol,
    strike1e9,
    underlyingAsset,
    warnings: [
      ...validationErrors.map((issue) => ({
        code: issue.code,
        level: 'blocked' as const,
        message: issue.message,
      })),
      ...validationWarnings.map((issue) => ({
        code: issue.code,
        level: 'caution' as const,
        message: issue.message,
      })),
    ],
  };
}

export function createPayoffVisualizerModelFromPreview(
  preview: PayoffPreviewLike | null | undefined,
): PayoffVisualizerModel | null {
  const snapshot = createPayoffSnapshotFromPreview(preview);

  return snapshot === null ? null : createPayoffVisualizerModelFromSnapshot(snapshot);
}

export function createPayoffSnapshotFromPreview(
  preview: PayoffPreviewLike | null | undefined,
): PayoffVisualizerSnapshot | null {
  if (preview === null || preview === undefined) {
    return null;
  }

  const action = 'action' in preview ? preview.action : undefined;
  const kind = getPreviewKind(preview);

  if (action === undefined || kind === null) {
    return null;
  }

  return {
    action,
    direction: getPreviewDirection(preview),
    estimatedCostQuote: preview.estimatedCostQuote,
    estimatedPayoutQuote: preview.estimatedPayoutQuote,
    expiryMs: preview.expiryMs,
    higherStrike1e9: 'higherStrike1e9' in preview ? preview.higherStrike1e9 : undefined,
    kind,
    lowerStrike1e9: 'lowerStrike1e9' in preview ? preview.lowerStrike1e9 : undefined,
    managerBalanceQuote: preview.managerBalanceQuote,
    managerId: preview.managerId,
    oracleFreshness: getPreviewOracleFreshness(preview),
    oracleId: preview.oracleId,
    oracleStatus: getPreviewOracleStatus(preview),
    quantityQuote: preview.quantityQuote,
    quoteAssetSymbol: preview.quoteAsset?.symbol ?? predictDeploymentConfig.quoteAsset.symbol,
    strike1e9: 'strike1e9' in preview ? preview.strike1e9 : undefined,
    underlyingAsset: preview.underlyingAsset,
    warnings: normalizePreviewWarnings(preview),
  };
}

export function createPayoffVisualizerModelFromSnapshot(
  snapshot: PayoffVisualizerSnapshot,
): PayoffVisualizerModel {
  const quoteSymbol = snapshot.quoteAssetSymbol ?? predictDeploymentConfig.quoteAsset.symbol;
  const estimate =
    snapshot.estimatedCostQuote !== undefined
      ? {
          label: 'Estimated cost',
          value: formatQuoteAmount(snapshot.estimatedCostQuote, quoteSymbol),
        }
      : snapshot.estimatedPayoutQuote !== undefined
        ? {
            label: 'Estimated payout',
            value: formatQuoteAmount(snapshot.estimatedPayoutQuote, quoteSymbol),
          }
        : {
            label: 'Estimated amount',
            value: 'Simulation required',
          };
  const warnings = [
    ...(snapshot.warnings ?? []),
    ...(estimate.value === 'Simulation required'
      ? [
          {
            code: 'SIMULATION_REQUIRED',
            level: 'caution' as const,
            message: 'Simulation is required before PredictPilot can show cost or payout.',
          },
        ]
      : []),
    ...getStateWarnings(snapshot),
  ];

  return {
    action: formatAction(snapshot.action),
    estimateLabel: estimate.label,
    estimateValue: estimate.value,
    facts: createFacts(snapshot, quoteSymbol),
    kind: snapshot.kind,
    lossCondition: createLossCondition(snapshot),
    title: createPayoffTitle(snapshot),
    warnings: dedupeWarnings(warnings),
    winCondition: createWinCondition(snapshot),
  };
}

function createFacts(snapshot: PayoffVisualizerSnapshot, quoteSymbol: string) {
  const strikeOrRange =
    snapshot.kind === 'binary'
      ? formatOptionalStrike(snapshot.strike1e9)
      : `${formatOptionalStrike(snapshot.lowerStrike1e9)} to ${formatOptionalStrike(
          snapshot.higherStrike1e9,
        )}`;

  return [
    { label: 'Action', value: formatAction(snapshot.action) },
    { label: 'Underlying', value: snapshot.underlyingAsset ?? 'Unavailable from current server data' },
    { label: snapshot.kind === 'binary' ? 'Strike' : 'Range', value: strikeOrRange },
    {
      label: 'Expiry',
      value:
        snapshot.expiryMs === undefined
          ? 'Unavailable from current server data'
          : formatExpiry(snapshot.expiryMs),
    },
    {
      label: 'Quantity',
      value:
        snapshot.quantityQuote === undefined
          ? 'Unavailable from current server data'
          : formatQuoteAmount(snapshot.quantityQuote, quoteSymbol),
    },
    {
      label: 'Manager balance',
      value:
        snapshot.managerBalanceQuote === undefined
          ? 'Unavailable from current server data'
          : formatQuoteAmount(snapshot.managerBalanceQuote, quoteSymbol),
    },
    { label: 'Quote asset', value: quoteSymbol },
    { label: 'Oracle', value: snapshot.oracleId ?? 'Unavailable from current server data' },
  ];
}

function createWinCondition(snapshot: PayoffVisualizerSnapshot) {
  if (snapshot.kind === 'range') {
    return `Wins if settlement is in (${formatOptionalStrike(
      snapshot.lowerStrike1e9,
    )}, ${formatOptionalStrike(snapshot.higherStrike1e9)}].`;
  }

  if (snapshot.direction === 'DOWN') {
    return `DOWN wins if settlement <= strike (${formatOptionalStrike(snapshot.strike1e9)}).`;
  }

  return `UP wins if settlement > strike (${formatOptionalStrike(snapshot.strike1e9)}).`;
}

function createLossCondition(snapshot: PayoffVisualizerSnapshot) {
  if (snapshot.kind === 'range') {
    return 'Loses if settlement finishes outside that range.';
  }

  if (snapshot.direction === 'DOWN') {
    return 'Loses if settlement finishes above the selected strike.';
  }

  return 'Loses if settlement finishes at or below the selected strike.';
}

function createPayoffTitle(snapshot: PayoffVisualizerSnapshot) {
  if (snapshot.kind === 'range') {
    return `${formatAction(snapshot.action)} range payoff`;
  }

  return `${snapshot.direction ?? 'Binary'} ${formatAction(snapshot.action)} payoff`;
}

function normalizePreviewWarnings(preview: PayoffPreviewLike): PayoffVisualizerWarning[] {
  const blockers =
    'blockers' in preview && Array.isArray(preview.blockers)
      ? preview.blockers.map((message) => ({
          code: 'BLOCKER',
          level: 'blocked' as const,
          message,
        }))
      : [];
  const warnings =
    'warnings' in preview && Array.isArray(preview.warnings)
      ? preview.warnings.map((warning) =>
          typeof warning === 'string'
            ? {
                code: 'WARNING',
                level: 'caution' as const,
                message: warning,
              }
            : {
                code: warning.code ?? 'WARNING',
                level: 'caution' as const,
                message: warning.message,
              },
        )
      : [];

  return [...blockers, ...warnings];
}

function getStateWarnings(snapshot: PayoffVisualizerSnapshot): PayoffVisualizerWarning[] {
  const warnings: PayoffVisualizerWarning[] = [];

  if (snapshot.quantityQuote !== undefined && snapshot.quantityQuote <= 0n) {
    warnings.push({
      code: 'INVALID_QUANTITY',
      level: 'blocked',
      message: 'Quantity must be greater than zero before any review can continue.',
    });
  }

  if (snapshot.kind === 'range') {
    if (
      snapshot.lowerStrike1e9 !== undefined &&
      snapshot.higherStrike1e9 !== undefined &&
      snapshot.lowerStrike1e9 >= snapshot.higherStrike1e9
    ) {
      warnings.push({
        code: 'INVALID_RANGE',
        level: 'blocked',
        message: 'Range lower strike must be below higher strike.',
      });
    }
  }

  if (snapshot.oracleStatus !== undefined && !isTradeableStatus(snapshot.oracleStatus)) {
    warnings.push({
      code: 'ORACLE_NOT_TRADEABLE',
      level: 'blocked',
      message: `Oracle lifecycle is ${snapshot.oracleStatus}; this may block trade review.`,
    });
  }

  if (snapshot.oracleFreshness !== undefined && snapshot.oracleFreshness !== 'FRESH') {
    warnings.push({
      code: 'ORACLE_FRESHNESS_CAUTION',
      level: 'caution',
      message: `Oracle freshness is ${snapshot.oracleFreshness}; refresh or simulation should confirm state before signing.`,
    });
  }

  return warnings;
}

function getPreviewKind(preview: PayoffPreviewLike): PayoffVisualizerKind | null {
  if ('payoffKind' in preview && preview.payoffKind !== undefined) {
    return preview.payoffKind;
  }

  if ('rangeKey' in preview || 'lowerStrike1e9' in preview || 'higherStrike1e9' in preview) {
    return 'range';
  }

  if ('marketKey' in preview || 'direction' in preview || 'strike1e9' in preview) {
    return 'binary';
  }

  return null;
}

function getPreviewDirection(preview: PayoffPreviewLike): BinaryDirection | undefined {
  if ('direction' in preview) {
    return preview.direction;
  }

  if ('marketKey' in preview) {
    return (preview.marketKey as MarketKeyModel | undefined)?.direction;
  }

  return undefined;
}

function getPreviewOracleStatus(preview: PayoffPreviewLike) {
  if (!('oracleStatus' in preview) || preview.oracleStatus === undefined) {
    return undefined;
  }

  return typeof preview.oracleStatus === 'string'
    ? preview.oracleStatus
    : preview.oracleStatus.lifecycleStatus;
}

function getPreviewOracleFreshness(preview: PayoffPreviewLike) {
  if (!('oracleStatus' in preview) || preview.oracleStatus === undefined) {
    return 'oracleFreshness' in preview ? preview.oracleFreshness : undefined;
  }

  return typeof preview.oracleStatus === 'string'
    ? 'oracleFreshness' in preview
      ? preview.oracleFreshness
      : undefined
    : preview.oracleStatus.freshness.aggregateStatus;
}

function isTradeableStatus(status: string) {
  return ['ACTIVE', 'active'].includes(status);
}

function dedupeWarnings(warnings: PayoffVisualizerWarning[]) {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.level}:${warning.code}:${warning.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function formatOptionalStrike(value: bigint | undefined) {
  return value === undefined ? 'Unavailable from current server data' : formatPrice1e9(value);
}

function formatExpiry(value: bigint | number) {
  return formatSafeIsoTimestamp(typeof value === 'bigint' ? value : BigInt(value));
}
