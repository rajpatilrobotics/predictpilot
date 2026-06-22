import { useCallback, type ReactNode } from 'react';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import {
  TerminalDatum,
  TerminalPageHeader,
  TerminalPanel,
} from '@/components/terminal/TerminalPanels';
import { StatePanel } from '@/components/states/StatePrimitives';
import { useTransactionHistory } from '@/features/history/hooks/useTransactionHistory';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import { useProofSession } from './proof-session-context';
import {
  selectProofModeViewModel,
  type ProofEvidenceRow,
  type ProofModeViewModel,
  type ProofRowStatus,
  type ProofSourceLabel,
} from './proof-selectors';

const PROOF_TITLE_ID = 'proof-mode-title';

export function ProofModePage() {
  const wallet = useWalletStatus();
  const manager = usePredictManager();
  const managerId = manager.managerId ?? undefined;
  const managerSummary = useManagerSummary({
    enabled: manager.isReady,
    managerId,
  });
  const positions = usePositionsSummary({
    enabled: manager.isReady,
    managerId,
  });
  const history = useTransactionHistory({
    enabled: manager.isReady,
    managerId,
    owner: manager.owner,
  });
  const { latestPreparedReview, latestSubmittedProof } = useProofSession();
  const viewModel = selectProofModeViewModel({
    history: history.data,
    historyError: history.error,
    historyLoading: history.isLoading || history.isFetching,
    latestPreparedReview,
    latestSubmittedProof,
    manager,
    managerSummary: managerSummary.data,
    managerSummaryError: managerSummary.error,
    managerSummaryLoading: managerSummary.isLoading || managerSummary.isFetching,
    positions: positions.data,
    positionsError: positions.error,
    positionsLoading: positions.isLoading || positions.isFetching,
    wallet,
  });

  const refreshProof = useCallback(() => {
    void Promise.all([managerSummary.refetch(), positions.refetch(), history.refetch()]);
  }, [history, managerSummary, positions]);

  return (
    <article
      aria-labelledby={PROOF_TITLE_ID}
      className="border border-[#c8d3ce] bg-white p-5 shadow-sm"
    >
      <TerminalPageHeader
        eyebrow="PP-061 Proof Mode"
        source="Source-labeled evidence"
        title="Proof Mode"
        titleId={PROOF_TITLE_ID}
      />

      <div className="mt-5 grid gap-4">
        <ProofVerdictBanner onRefresh={refreshProof} viewModel={viewModel} />
        <SourceLabelStrip labels={viewModel.sourceLabels} />

        <div className="grid gap-4 xl:grid-cols-3">
          <ProofRowsPanel rows={viewModel.readinessRows} title="Readiness" />
          <ProofRowsPanel rows={viewModel.executionRows} title="Execution proof" />
          <ProofRowsPanel rows={viewModel.reconciliationRows} title="Reconciliation" />
        </div>

        <DigestProofCard digest={viewModel.digest} />
        <ProofActionLinks digest={viewModel.digest} />
      </div>
    </article>
  );
}

function ProofVerdictBanner({
  onRefresh,
  viewModel,
}: {
  onRefresh: () => void;
  viewModel: ProofModeViewModel;
}) {
  return (
    <StatePanel
      action={
        <button
          className="border border-[#8ba79c] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315447]"
          onClick={onRefresh}
          type="button"
        >
          Refresh proof
        </button>
      }
      description={viewModel.explanation}
      label="Proof verdict"
      title={viewModel.title}
      tone={viewModel.tone}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TerminalDatum label="Verdict" value={viewModel.status} />
        <TerminalDatum
          label="Digest source"
          value={viewModel.digest === null ? 'No submitted digest' : 'Chain digest available'}
        />
        <TerminalDatum
          label="Indexed source"
          value={
            viewModel.matchedHistoryDigest === null
              ? 'Awaiting matching history'
              : 'Predict server matched'
          }
        />
      </div>
    </StatePanel>
  );
}

function SourceLabelStrip({ labels }: { labels: ProofSourceLabel[] }) {
  return (
    <section
      aria-label="Proof evidence sources"
      className="flex flex-wrap gap-2 border border-[#d9dfdc] bg-[#fbfcfc] p-3"
    >
      {labels.map((label) => (
        <span
          className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusClassName(
            label.status,
          )}`}
          key={label.label}
        >
          <span aria-hidden="true" className="h-2 w-2 bg-current" />
          {label.label}
        </span>
      ))}
    </section>
  );
}

function ProofRowsPanel({ rows, title }: { rows: ProofEvidenceRow[]; title: string }) {
  return (
    <TerminalPanel title={title}>
      <dl className="grid gap-3">
        {rows.map((row) => (
          <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3" key={`${title}-${row.label}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
                {row.label}
              </dt>
              <EvidenceBadge status={row.status}>{row.source}</EvidenceBadge>
            </div>
            <dd className="mt-2 break-words text-sm font-semibold text-[#17211d]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </TerminalPanel>
  );
}

function DigestProofCard({ digest }: { digest: string | null }) {
  if (digest === null) {
    return (
      <StatePanel
        description="No submitted transaction yet. Prepare a strategy or open Demo Mode; Proof Mode will not show a fake digest."
        label="No submitted proof"
        title="No submitted transaction"
        tone="empty"
      />
    );
  }

  return (
    <section
      aria-label="Digest proof card"
      className="border border-[#8fbda5] bg-[#edf7f1] p-5 text-[#25513c]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">Chain digest evidence</p>
      <h2 className="mt-2 text-xl font-semibold">Real digest recorded</h2>
      <p className="mt-2 break-all text-sm leading-6">{digest}</p>
      <div className="mt-4">
        <TxDigestLink
          className="inline-flex border border-[#8ba79c] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1]"
          digest={digest}
          label="Open explorer proof"
        />
      </div>
    </section>
  );
}

function ProofActionLinks({ digest }: { digest: string | null }) {
  return (
    <nav aria-label="Proof follow-up actions" className="flex flex-wrap gap-2">
      <ProofLink href="/portfolio">Open portfolio</ProofLink>
      <ProofLink href="/history">Open history</ProofLink>
      <ProofLink href="/markets">Open markets</ProofLink>
      {digest === null ? null : (
        <TxDigestLink
          className="border border-[#b8c6c0] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1]"
          digest={digest}
          label="Open explorer"
        />
      )}
    </nav>
  );
}

function ProofLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="border border-[#b8c6c0] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315447]"
      href={href}
    >
      {children}
    </a>
  );
}

function EvidenceBadge({ children, status }: { children: ReactNode; status: ProofRowStatus }) {
  return (
    <span
      className={`border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClassName(
        status,
      )}`}
    >
      {children}
    </span>
  );
}

function statusClassName(status: ProofRowStatus) {
  switch (status) {
    case 'blocked':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
    case 'failed':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'info':
      return 'border-[#d9dfdc] bg-white text-[#64736e]';
    case 'pass':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'pending':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
  }
}
