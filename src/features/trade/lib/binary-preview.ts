import type {
  BinaryTradePreviewModel,
  BinaryTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import type { QuoteAmount } from '@/types/predict';

export interface BinaryPreviewPrimaryAmount {
  amountQuote: QuoteAmount;
  label: 'Estimated cost' | 'Estimated payout';
}

export function getBinaryPreviewPrimaryAmount(
  preview: BinaryTradePreviewModel,
): BinaryPreviewPrimaryAmount {
  if (preview.action === 'MINT') {
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

export function getBinaryPreviewActionCopy(preview: Pick<BinaryTradePreviewModel, 'action'>) {
  return preview.action === 'MINT' ? 'Mint binary position' : 'Redeem binary position';
}

export function getBinaryPreviewAmountCopy(preview: BinaryTradePreviewModel) {
  const primary = getBinaryPreviewPrimaryAmount(preview);
  return `${primary.label}: ${primary.amountQuote.toString()} ${preview.quoteAsset.symbol}`;
}

export function getBinaryPreviewWarningCount(warnings: BinaryTradePreviewWarning[]) {
  return warnings.filter((warning) => warning.severity === 'warning').length;
}
