import type { BinaryTradePreviewModel } from '@/integrations/deepbook-predict/tx/preview-binary';
import type { RangeTradePreviewModel } from '@/integrations/deepbook-predict/tx/preview-range';
import { InlineStateNotice } from '@/components/states/StatePrimitives';
import { TerminalDatum, TerminalPanel } from '@/components/terminal/TerminalPanels';

type RiskWarningInput =
  | string
  | {
      message: string;
      severity?: 'info' | 'warning';
    };

export interface RiskPreviewModel {
  action?: string;
  askBoundsStatus?: string;
  blockers?: string[];
  estimatedCostQuote?: bigint;
  estimatedPayoutQuote?: bigint;
  expiryMs?: bigint | number;
  managerBalanceQuote?: bigint;
  managerId?: string;
  oracleFreshness?: string;
  oracleId?: string;
  oracleStatus?: string;
  quantityQuote?: bigint;
  quoteAsset?: {
    symbol: string;
  };
  title?: string;
  underlyingAsset?: string;
  warnings?: RiskWarningInput[];
}

export interface RiskPreviewProps {
  className?: string;
  preview?: BinaryTradePreviewModel | RangeTradePreviewModel | RiskPreviewModel | null;
  title?: string;
}

const unavailableCopy = 'Unavailable / TODO VERIFY';

export function RiskPreview({ className = '', preview, title = 'Risk preview' }: RiskPreviewProps) {
  const model = normalizeRiskPreview(preview);
  const rows = createRiskRows(model);
  const warnings = normalizeWarnings(model.warnings);
  const blockers = model.blockers ?? [];

  return (
    <TerminalPanel title={title}>
      <div className={className}>
        <dl className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <TerminalDatum key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>

        <div className="mt-4 grid gap-3">
          {blockers.length === 0 ? null : (
            <InlineStateNotice tone="blocked">
              <strong className="font-semibold">Blocked before signing.</strong>{' '}
              {blockers.join(' ')}
            </InlineStateNotice>
          )}

          {warnings.length === 0 ? (
            <InlineStateNotice>
              Missing optional risk data is shown as unavailable instead of estimated. Exact
              received amounts still require simulation or onchain confirmation.
            </InlineStateNotice>
          ) : (
            <ul className="grid gap-2" aria-label="Risk warnings">
              {warnings.map((warning) => (
                <li key={warning}>
                  <InlineStateNotice>{warning}</InlineStateNotice>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TerminalPanel>
  );
}

function normalizeRiskPreview(
  preview: BinaryTradePreviewModel | RangeTradePreviewModel | RiskPreviewModel | null | undefined,
): RiskPreviewModel {
  if (preview === null || preview === undefined) {
    return {};
  }

  return {
    action: preview.action,
    askBoundsStatus: getManualField(preview, 'askBoundsStatus'),
    estimatedCostQuote: preview.estimatedCostQuote,
    estimatedPayoutQuote: preview.estimatedPayoutQuote,
    expiryMs: preview.expiryMs,
    managerBalanceQuote: preview.managerBalanceQuote,
    managerId: preview.managerId,
    oracleFreshness: hasOracleStatusModel(preview)
      ? preview.oracleStatus.freshness.aggregateStatus
      : getManualField(preview, 'oracleFreshness'),
    oracleId: preview.oracleId,
    oracleStatus: hasOracleStatusModel(preview)
      ? preview.oracleStatus.lifecycleStatus
      : getManualField(preview, 'oracleStatus'),
    quantityQuote: preview.quantityQuote,
    quoteAsset: preview.quoteAsset,
    underlyingAsset: preview.underlyingAsset,
    warnings: preview.warnings,
    ...('blockers' in preview && preview.blockers !== undefined
      ? { blockers: preview.blockers }
      : {}),
  };
}

function createRiskRows(model: RiskPreviewModel) {
  const quoteSymbol = model.quoteAsset?.symbol ?? 'DUSDC';
  const estimatedAmount =
    model.estimatedCostQuote !== undefined
      ? {
          label: 'Estimated cost',
          value: formatQuoteAmount(model.estimatedCostQuote, quoteSymbol),
        }
      : model.estimatedPayoutQuote !== undefined
        ? {
            label: 'Estimated payout',
            value: formatQuoteAmount(model.estimatedPayoutQuote, quoteSymbol),
          }
        : {
            label: 'Estimated amount',
            value: 'Simulation required',
          };

  return [
    { label: 'Action', value: model.action ?? unavailableCopy },
    { label: 'Underlying', value: model.underlyingAsset ?? unavailableCopy },
    { label: 'Oracle status', value: model.oracleStatus ?? unavailableCopy },
    { label: 'Oracle freshness', value: model.oracleFreshness ?? unavailableCopy },
    { label: 'Ask bounds', value: model.askBoundsStatus ?? unavailableCopy },
    { label: 'Expiry', value: formatOptionalValue(model.expiryMs, 'ms') },
    {
      label: 'Manager balance',
      value: formatOptionalQuote(model.managerBalanceQuote, quoteSymbol),
    },
    { label: 'Quantity', value: formatOptionalQuote(model.quantityQuote, quoteSymbol) },
    estimatedAmount,
    { label: 'Manager', value: model.managerId ?? unavailableCopy },
    { label: 'Oracle', value: model.oracleId ?? unavailableCopy },
  ];
}

function normalizeWarnings(warnings: RiskPreviewModel['warnings']): string[] {
  if (warnings === undefined) {
    return [];
  }

  return warnings.map((warning) => (typeof warning === 'string' ? warning : warning.message));
}

function formatOptionalQuote(value: bigint | undefined, symbol: string) {
  return value === undefined ? unavailableCopy : formatQuoteAmount(value, symbol);
}

function formatQuoteAmount(value: bigint, symbol: string) {
  return `${value.toString()} ${symbol}`;
}

function formatOptionalValue(value: bigint | number | undefined, suffix: string) {
  return value === undefined ? unavailableCopy : `${value.toString()} ${suffix}`;
}

function hasOracleStatusModel(
  preview: BinaryTradePreviewModel | RangeTradePreviewModel | RiskPreviewModel,
): preview is BinaryTradePreviewModel | RangeTradePreviewModel {
  return (
    'oracleStatus' in preview &&
    typeof preview.oracleStatus === 'object' &&
    preview.oracleStatus !== null &&
    'freshness' in preview.oracleStatus
  );
}

function getManualField<Key extends keyof RiskPreviewModel>(
  preview: BinaryTradePreviewModel | RangeTradePreviewModel | RiskPreviewModel,
  key: Key,
): RiskPreviewModel[Key] | undefined {
  return key in preview ? (preview as RiskPreviewModel)[key] : undefined;
}
