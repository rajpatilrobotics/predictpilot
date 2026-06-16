import type {
  RangeTradePreviewModel,
  RangeTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-range';
import type { QuoteAmount } from '@/types/predict';

export interface RangePreviewPrimaryAmount {
  amountQuote: QuoteAmount;
  label: 'Estimated cost' | 'Estimated payout';
}

export function getRangePreviewPrimaryAmount(
  preview: RangeTradePreviewModel,
): RangePreviewPrimaryAmount {
  if (preview.action === 'MINT_RANGE') {
    return {
      amountQuote: preview.estimatedCostQuote ?? 0n,
      label: 'Estimated cost',
    };
  }

  return {
    amountQuote: preview.estimatedPayoutQuote ?? 0n,
    label: 'Estimated payout',
  };
}

export function getRangePreviewActionCopy(preview: Pick<RangeTradePreviewModel, 'action'>) {
  return preview.action === 'MINT_RANGE' ? 'Mint range position' : 'Redeem range position';
}

export function getRangePreviewAmountCopy(preview: RangeTradePreviewModel) {
  const primary = getRangePreviewPrimaryAmount(preview);
  return `${primary.label}: ${primary.amountQuote.toString()} ${preview.quoteAsset.symbol}`;
}

export function getRangePreviewBandCopy(
  preview: Pick<RangeTradePreviewModel, 'higherStrike1e9' | 'lowerStrike1e9'>,
) {
  return `${preview.lowerStrike1e9.toString()} - ${preview.higherStrike1e9.toString()}`;
}

export function getRangePreviewWarningCount(warnings: RangeTradePreviewWarning[]) {
  return warnings.filter((warning) => warning.severity === 'warning').length;
}
