import { useMemo, useState } from 'react';
import { StatePanel } from '@/components/states/StatePrimitives';
import {
  TerminalDatum,
  TerminalPageHeader,
  TerminalPanel,
} from '@/components/terminal/TerminalPanels';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import { useTransactionHistory } from '@/features/history/hooks/useTransactionHistory';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import {
  getTopBestDemoMarket,
  rankBestDemoMarkets,
  type BestDemoMarketReadiness,
} from '@/features/markets/lib/best-market-finder';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import { useProofSession } from '@/features/proof/proof-session-context';
import { selectProofModeViewModel } from '@/features/proof/proof-selectors';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import {
  selectJudgeDemoPathViewModel,
  type JudgeDemoStep,
  type JudgeDemoStepStatus,
} from './judge-demo-path';

const JUDGE_DEMO_TITLE_ID = 'judge-demo-title';

export function JudgeDemoPathPage() {
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
  const oracles = usePredictOracles();
  const { latestPreparedReview, latestSubmittedProof } = useProofSession();
  const [mountedAtMs] = useState(() => Date.now());
  const readiness = useMemo<BestDemoMarketReadiness>(
    () => ({
      hasManagerDusdc:
        managerSummary.data !== undefined &&
        managerSummary.data.balanceSummary.tradingBalanceQuote > 0n,
      isManagerReady: manager.isReady,
      isWalletConnected: wallet.isConnected,
      isWalletOnTestnet: wallet.isExpectedNetwork,
    }),
    [manager.isReady, managerSummary.data, wallet.isConnected, wallet.isExpectedNetwork],
  );
  const bestMarket = useMemo(() => {
    const rankedMarkets = rankBestDemoMarkets({
      nowMs: mountedAtMs,
      oracles: oracles.data ?? [],
      readiness,
    });

    return getTopBestDemoMarket(rankedMarkets);
  }, [mountedAtMs, oracles.data, readiness]);
  const proofViewModel = selectProofModeViewModel({
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
  const viewModel = selectJudgeDemoPathViewModel({
    bestMarket,
    bestMarketLoading: oracles.isLoading || oracles.isFetching,
    historyLoading: history.isLoading || history.isFetching,
    latestPreparedReview,
    latestSubmittedProof,
    manager,
    managerSummary: managerSummary.data,
    managerSummaryLoading: managerSummary.isLoading || managerSummary.isFetching,
    proof: proofViewModel,
    wallet,
  });

  return (
    <article aria-labelledby={JUDGE_DEMO_TITLE_ID} className="space-y-5">
      <section className="border border-[#c8d3ce] bg-white p-5 shadow-sm">
        <TerminalPageHeader
          eyebrow="PP-067 Judge Demo Path"
          source="Live guided runway"
          title="Judge Demo Path"
          titleId={JUDGE_DEMO_TITLE_ID}
        />
        <p className="mt-4 max-w-4xl text-sm leading-6 text-[#52615c]">
          Follow this path during judging to move from live readiness to market selection, execution
          review, digest proof, indexed refresh, and Proof Mode. This page guides existing real
          flows; it does not sign, submit, or fabricate proof.
        </p>
      </section>

      <StatePanel
        action={<PrimaryStepLink step={viewModel.currentStep} />}
        description={viewModel.summary}
        label="Judge demo verdict"
        title={viewModel.verdict}
        tone={viewModel.tone}
      />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <TerminalPanel title="Demo steps">
          <ol className="space-y-2">
            {viewModel.steps.map((step, index) => (
              <JudgeDemoStepListItem index={index} key={step.id} step={step} />
            ))}
          </ol>
        </TerminalPanel>

        <TerminalPanel title="Current judge action">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
                {viewModel.currentStep.label}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#17211d]">
                {viewModel.currentStep.title}
              </h2>
              <p className="mt-2 max-w-3xl leading-7 text-[#3f514b]">
                {viewModel.currentStep.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryStepLink step={viewModel.currentStep} />
              <a className={secondaryLinkClassName} href="/proof">
                Open Proof Mode
              </a>
              <a className={secondaryLinkClassName} href="/demo">
                Offline Demo Mode
              </a>
            </div>
            <p className="border border-[#e0c891] bg-[#fff9ea] p-3 text-sm leading-6 text-[#5c4720]">
              Only the existing strategy, manager, and vault screens can request a wallet signature.
              This page never creates a digest by itself.
            </p>
          </div>
        </TerminalPanel>

        <TerminalPanel title="Demo evidence">
          <dl className="grid gap-3">
            {viewModel.evidence.map((item) => (
              <TerminalDatum
                key={`${item.source}:${item.label}`}
                label={`${item.label} [${item.source}]`}
                value={item.value}
              />
            ))}
          </dl>
          {latestSubmittedProof === null ? (
            <p className="mt-4 border border-[#d9dfdc] bg-[#fbfcfc] p-3 text-sm leading-6 text-[#52615c]">
              No submitted digest yet. Prepare a strategy and approve a real Testnet wallet
              transaction before claiming proof.
            </p>
          ) : (
            <TxDigestLink
              className="mt-4 inline-block border border-[#315447] bg-[#315447] px-3 py-2 text-sm font-semibold text-white"
              digest={latestSubmittedProof.completedDigest}
              label="Open digest in Sui Explorer"
            />
          )}
        </TerminalPanel>
      </div>
    </article>
  );
}

function JudgeDemoStepListItem({ index, step }: { index: number; step: JudgeDemoStep }) {
  return (
    <li className={`border p-3 ${stepClassName(step.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-current">
            Step {index + 1}
          </p>
          <p className="mt-1 font-semibold">{step.label}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em]">
          {step.status}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5">{step.title}</p>
    </li>
  );
}

function PrimaryStepLink({ step }: { step: JudgeDemoStep }) {
  return (
    <a className={primaryLinkClassName} href={step.actionHref}>
      {step.actionLabel}
    </a>
  );
}

function stepClassName(status: JudgeDemoStepStatus) {
  switch (status) {
    case 'blocked':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
    case 'complete':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'current':
      return 'border-[#8ea79e] bg-[#edf5f1] text-[#17211d]';
    case 'failed':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'pending':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
    case 'ready':
      return 'border-[#d9dfdc] bg-white text-[#445750]';
  }
}

const primaryLinkClassName =
  'inline-flex w-fit border border-[#315447] bg-[#315447] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#244a3c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315447]';

const secondaryLinkClassName =
  'inline-flex w-fit border border-[#8ea79e] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315447]';
