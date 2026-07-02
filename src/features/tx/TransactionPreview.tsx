import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import { toPredictTxPreviewViewModel } from '@/features/tx/lib/tx-preview';
import { InlineStateNotice } from '@/components/states/StatePrimitives';
import { TerminalDatum, TerminalPanel } from '@/components/terminal/TerminalPanels';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import type { PredictPilotError } from '@/lib/errors';

export interface TransactionPreviewProps {
  className?: string;
  completedDigest?: string;
  executionError?: PredictPilotError | null;
  executionNotice?: string | null;
  onRequestSignature?: () => void;
  onSimulate?: () => void;
  preview: PredictPtbSimulationPreview;
}

export function TransactionPreview({
  className = '',
  completedDigest,
  executionError,
  executionNotice,
  onRequestSignature,
  onSimulate,
  preview,
}: TransactionPreviewProps) {
  const viewModel = toPredictTxPreviewViewModel(preview);
  const statusTone = getStatusTone(viewModel.status);

  return (
    <TerminalPanel title="Transaction preview">
      <div className={className}>
        <div className="flex flex-col gap-3 border-b border-[#d9dfdc] pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#446b5e]">Pre-sign review</p>
            <h2 className="mt-2 text-xl font-semibold text-[#17211d]">{viewModel.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53645f]">
              {viewModel.statusCopy}
            </p>
          </div>
          <span
            aria-live="polite"
            className={`w-fit border px-3 py-1 text-xs font-semibold uppercase ${statusTone}`}
          >
            {formatStatusLabel(viewModel.status)}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {viewModel.rows.map((row) => (
            <TerminalDatum key={`${row.label}:${row.value}`} label={row.label} value={row.value} />
          ))}
        </dl>

        <div className="mt-4 grid gap-3">
          {viewModel.warnings.length === 0 ? null : (
            <ul className="grid gap-2" aria-label="Transaction warnings">
              {viewModel.warnings.map((warning) => (
                <li key={warning}>
                  <InlineStateNotice>{warning}</InlineStateNotice>
                </li>
              ))}
            </ul>
          )}

          {viewModel.recoveryCopy === undefined ? null : (
            <InlineStateNotice tone={viewModel.status === 'error' ? 'error' : 'blocked'}>
              {viewModel.recoveryCopy}
            </InlineStateNotice>
          )}

          {executionNotice === null || executionNotice === undefined ? null : (
            <InlineStateNotice tone="warning">{executionNotice}</InlineStateNotice>
          )}

          {executionError === null || executionError === undefined ? null : (
            <InlineStateNotice
              tone={executionError.severity === 'info' ? 'warning' : 'error'}
            >{`${executionError.title}: ${executionError.message} ${executionError.recovery}`}</InlineStateNotice>
          )}

          {completedDigest === undefined ? null : (
            <InlineStateNotice tone="success">
              Completed digest:{' '}
              <TxDigestLink
                className="font-semibold underline underline-offset-2"
                digest={completedDigest}
                label="View transaction on Sui Explorer"
              />
            </InlineStateNotice>
          )}

          <p className="text-sm leading-6 text-[#53645f]">
            This is a pre-sign review, not proof of execution. The wallet signature request is
            enabled only after simulation is ready.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {onSimulate === undefined ? null : (
            <button
              className="border border-[#17211d] bg-white px-4 py-2 text-sm font-semibold text-[#17211d]"
              onClick={onSimulate}
              type="button"
            >
              Run simulation
            </button>
          )}

          {onRequestSignature === undefined ? null : (
            <button
              className="border border-[#17211d] bg-[#17211d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[#c7d0cc] disabled:bg-[#e8eeeb] disabled:text-[#72817b]"
              disabled={!viewModel.canRequestSignature}
              onClick={onRequestSignature}
              type="button"
            >
              Request wallet signature
            </button>
          )}
        </div>
      </div>
    </TerminalPanel>
  );
}

function formatStatusLabel(status: PredictPtbSimulationPreview['status']) {
  switch (status) {
    case 'TODO_VERIFY_BLOCKED':
      return 'Verification blocked';
    case 'blocked':
      return 'Blocked';
    case 'error':
      return 'Error';
    case 'loading':
      return 'Loading';
    case 'ready':
      return 'Ready';
  }
}

function getStatusTone(status: PredictPtbSimulationPreview['status']) {
  switch (status) {
    case 'ready':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'loading':
      return 'border-[#b8c6c0] bg-[#f4f8f6] text-[#446b5e]';
    case 'blocked':
    case 'TODO_VERIFY_BLOCKED':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
    case 'error':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
  }
}
