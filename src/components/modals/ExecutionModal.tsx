import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import { RiskPreview, type RiskPreviewProps } from '@/features/tx/RiskPreview';
import { TransactionPreview } from '@/features/tx/TransactionPreview';

export interface ExecutionModalProps {
  completedDigest?: string;
  onClose: () => void;
  onRequestSignature?: () => void;
  onSimulate?: () => void;
  open: boolean;
  preview: PredictPtbSimulationPreview;
  risk?: RiskPreviewProps['preview'];
  title?: string;
}

export function ExecutionModal({
  completedDigest,
  onClose,
  onRequestSignature,
  onSimulate,
  open,
  preview,
  risk,
  title = 'Execution review',
}: ExecutionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#07110d]/70 p-3 sm:p-4"
      role="dialog"
      tabIndex={-1}
    >
      <div className="mx-auto flex min-h-full max-w-5xl items-center">
        <div className="w-full min-w-0 border border-[#d9dfdc] bg-[#f7faf8] p-3 shadow-2xl sm:p-4">
          <header className="flex flex-col gap-3 border-b border-[#d9dfdc] pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#446b5e]">
                PredictPilot pre-sign terminal
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#17211d]">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53645f]">
                Review risk, simulation, and affected Predict objects before requesting a wallet
                signature.
              </p>
            </div>
            <button
              aria-label="Close execution review"
              className="w-fit border border-[#17211d] bg-white px-4 py-2 text-sm font-semibold text-[#17211d]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </header>

          <div className="mt-4 grid gap-4">
            <RiskPreview preview={risk} />
            <TransactionPreview
              completedDigest={completedDigest}
              onRequestSignature={onRequestSignature}
              onSimulate={onSimulate}
              preview={preview}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
