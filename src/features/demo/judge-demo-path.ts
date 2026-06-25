import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { BestDemoMarketCandidate } from '@/features/markets/lib/best-market-finder';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import type { ProofModeViewModel, ProofVerdictStatus } from '@/features/proof/proof-selectors';
import type {
  ProofPreparedReviewRecord,
  ProofSubmittedRecord,
} from '@/features/proof/proof-session-context';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';

export type JudgeDemoStepStatus =
  | 'blocked'
  | 'complete'
  | 'current'
  | 'failed'
  | 'pending'
  | 'ready';

export type JudgeDemoEvidenceSource = 'Chain' | 'Local' | 'Predict server' | 'Wallet';

export type JudgeDemoVerdict =
  | 'Blocked'
  | 'Chain confirmed'
  | 'Pending index'
  | 'Ready for live demo'
  | 'Verified in app';

export type JudgeDemoStepId =
  | 'best-market'
  | 'digest'
  | 'environment'
  | 'execution-review'
  | 'manager-funding'
  | 'oracle-health'
  | 'proof-mode'
  | 'reconciliation'
  | 'strategy-preview';

export interface JudgeDemoStep {
  actionHref: string;
  actionLabel: string;
  description: string;
  evidenceSource: JudgeDemoEvidenceSource;
  id: JudgeDemoStepId;
  label: string;
  status: JudgeDemoStepStatus;
  title: string;
}

export interface JudgeDemoEvidenceItem {
  label: string;
  source: JudgeDemoEvidenceSource;
  value: string;
}

export interface JudgeDemoPathViewModel {
  currentStep: JudgeDemoStep;
  evidence: JudgeDemoEvidenceItem[];
  steps: JudgeDemoStep[];
  summary: string;
  tone: 'blocked' | 'empty' | 'success' | 'warning';
  verdict: JudgeDemoVerdict;
}

export interface SelectJudgeDemoPathOptions {
  bestMarket: BestDemoMarketCandidate | null;
  bestMarketLoading: boolean;
  historyLoading: boolean;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  manager: UsePredictManagerResult;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
  managerSummaryLoading: boolean;
  proof: ProofModeViewModel;
  wallet: WalletStatusModel;
}

export function selectJudgeDemoPathViewModel({
  bestMarket,
  bestMarketLoading,
  historyLoading,
  latestPreparedReview,
  latestSubmittedProof,
  manager,
  managerSummary,
  managerSummaryLoading,
  proof,
  wallet,
}: SelectJudgeDemoPathOptions): JudgeDemoPathViewModel {
  const hasWalletReady = wallet.isConnected && wallet.isExpectedNetwork;
  const hasBestMarket = bestMarket !== null;
  const hasManagerReady = manager.isReady;
  const hasManagerDusdc =
    managerSummary !== undefined && managerSummary.balanceSummary.tradingBalanceQuote > 0n;
  const hasPreparedReview = latestPreparedReview !== null;
  const hasSubmittedDigest =
    latestSubmittedProof !== null && latestSubmittedProof.confirmedStatus === 'success';
  const hasVerifiedProof = proof.status === 'Verified';
  const hasPendingIndex = hasSubmittedDigest && !hasVerifiedProof;
  const isFailed = proof.status === 'Failed' || latestSubmittedProof?.confirmedStatus === 'failure';
  const hasLiveReadiness = hasWalletReady && hasBestMarket && hasManagerReady && hasManagerDusdc;

  const steps: JudgeDemoStep[] = [
    step({
      actionHref: '/dashboard',
      actionLabel: wallet.isConnected ? 'Review wallet status' : 'Connect wallet',
      description: hasWalletReady
        ? 'Wallet is connected on Sui Testnet.'
        : 'Connect a Sui wallet and switch it to Testnet before any live proof can start.',
      evidenceSource: 'Wallet',
      id: 'environment',
      label: 'Environment',
      status: hasWalletReady ? 'complete' : 'blocked',
      title: 'Connect wallet and confirm Testnet',
    }),
    step({
      actionHref: bestMarket?.strategyHref ?? '/markets',
      actionLabel: hasBestMarket ? 'Open Best Strategy' : 'Open Markets',
      description: hasBestMarket
        ? 'A recommended demo market is available. Open it to inspect the selected oracle.'
        : 'Find an active, non-expired market before staging a strategy.',
      evidenceSource: 'Predict server',
      id: 'best-market',
      label: 'Best market',
      status: getBestMarketStatus({ bestMarketLoading, hasBestMarket, hasWalletReady }),
      title: 'Pick a live demo market',
    }),
    step({
      actionHref: bestMarket?.auditHref ?? '/oracle-status',
      actionLabel: 'Audit Oracle',
      description: hasBestMarket
        ? 'Check lifecycle, freshness, expiry, ask-bounds, and strike validity before signing.'
        : 'Oracle health is unavailable until a demo market is selected.',
      evidenceSource: 'Local',
      id: 'oracle-health',
      label: 'Oracle health',
      status: getDependentStatus(hasBestMarket, hasWalletReady),
      title: 'Validate oracle tradeability',
    }),
    step({
      actionHref: '/manager',
      actionLabel: hasManagerReady ? 'Review manager funding' : 'Open PredictManager',
      description: getManagerFundingDescription({
        hasManagerDusdc,
        hasManagerReady,
        managerSummaryLoading,
      }),
      evidenceSource: 'Predict server',
      id: 'manager-funding',
      label: 'Manager + DUSDC',
      status: getManagerFundingStatus({
        hasManagerDusdc,
        hasManagerReady,
        hasWalletReady,
        manager,
        managerSummaryLoading,
      }),
      title: 'Confirm manager and DUSDC readiness',
    }),
    step({
      actionHref: bestMarket?.strategyHref ?? '/strategy',
      actionLabel: hasPreparedReview ? 'Review prepared strategy' : 'Open strategy builder',
      description: hasPreparedReview
        ? 'A local simulation-ready review has been recorded. It is not chain proof yet.'
        : 'Choose binary or range inputs, then open execution review from the strategy page.',
      evidenceSource: 'Local',
      id: 'strategy-preview',
      label: 'Strategy',
      status: getStrategyStatus({
        hasBestMarket,
        hasManagerDusdc,
        hasPreparedReview,
        hasSubmittedDigest,
      }),
      title: 'Review selected strategy',
    }),
    step({
      actionHref: bestMarket?.strategyHref ?? '/strategy',
      actionLabel: hasPreparedReview ? 'Open prepared route' : 'Prepare review',
      description: hasPreparedReview
        ? 'PTB review and simulation context exists. Signing still happens only from the execution modal.'
        : 'Build and simulate a transaction before asking the wallet to sign.',
      evidenceSource: 'Local',
      id: 'execution-review',
      label: 'PTB preview',
      status:
        hasPreparedReview || hasSubmittedDigest
          ? 'complete'
          : getStrategyStatus({ hasBestMarket, hasManagerDusdc }),
      title: 'Simulate before signing',
    }),
    step({
      actionHref: '/proof',
      actionLabel: hasSubmittedDigest ? 'Open Proof Center' : 'Open proof checkpoint',
      description: hasSubmittedDigest
        ? 'A real Testnet digest exists from wallet submission.'
        : 'No digest exists yet. Do not claim live execution proof before wallet submission.',
      evidenceSource: 'Chain',
      id: 'digest',
      label: 'Digest',
      status: getDigestStatus({ hasPreparedReview, hasSubmittedDigest, isFailed }),
      title: 'Capture digest after wallet submission',
    }),
    step({
      actionHref: hasPendingIndex ? '/history' : '/proof',
      actionLabel: hasPendingIndex ? 'Open History' : 'Open Proof Center',
      description: hasVerifiedProof
        ? 'History and app reconciliation are visible.'
        : hasSubmittedDigest
          ? 'Chain digest is real. Predict server portfolio or history may still be catching up.'
          : 'Reconciliation starts only after a real digest exists.',
      evidenceSource: 'Predict server',
      id: 'reconciliation',
      label: 'Reconcile',
      status: getReconciliationStatus({ hasSubmittedDigest, hasVerifiedProof, historyLoading }),
      title: 'Refresh portfolio and history',
    }),
    step({
      actionHref: '/proof',
      actionLabel: 'Open Proof Center',
      description: hasVerifiedProof
        ? 'Proof Center can show the verified evidence bundle.'
        : 'Use Proof Center to separate wallet, chain, Predict server, and local evidence.',
      evidenceSource: 'Local',
      id: 'proof-mode',
      label: 'Proof Center',
      status: hasVerifiedProof ? 'complete' : hasSubmittedDigest ? 'pending' : 'ready',
      title: 'Finish in Proof Center',
    }),
  ];
  const currentStep = steps.find((candidate) => candidate.status !== 'complete') ?? steps.at(-1);
  const verdict = getVerdict({
    hasLiveReadiness,
    hasSubmittedDigest,
    hasVerifiedProof,
    isFailed,
    proofStatus: proof.status,
  });

  return {
    currentStep: currentStep ?? steps[0],
    evidence: buildEvidence({
      bestMarket,
      latestSubmittedProof,
      manager,
      managerSummary,
      proof,
      wallet,
    }),
    steps: markCurrentStep(steps),
    summary: getVerdictSummary(verdict),
    tone: getVerdictTone(verdict),
    verdict,
  };
}

function step(input: JudgeDemoStep): JudgeDemoStep {
  return input;
}

function getBestMarketStatus({
  bestMarketLoading,
  hasBestMarket,
  hasWalletReady,
}: {
  bestMarketLoading: boolean;
  hasBestMarket: boolean;
  hasWalletReady: boolean;
}): JudgeDemoStepStatus {
  if (!hasWalletReady) {
    return 'ready';
  }

  if (bestMarketLoading) {
    return 'pending';
  }

  return hasBestMarket ? 'complete' : 'blocked';
}

function getDependentStatus(
  dependencyReady: boolean,
  hasWalletReady: boolean,
): JudgeDemoStepStatus {
  if (!hasWalletReady) {
    return 'ready';
  }

  return dependencyReady ? 'complete' : 'blocked';
}

function getManagerFundingStatus({
  hasManagerDusdc,
  hasManagerReady,
  hasWalletReady,
  manager,
  managerSummaryLoading,
}: {
  hasManagerDusdc: boolean;
  hasManagerReady: boolean;
  hasWalletReady: boolean;
  manager: UsePredictManagerResult;
  managerSummaryLoading: boolean;
}): JudgeDemoStepStatus {
  if (!hasWalletReady) {
    return 'ready';
  }

  if (manager.isLoading || manager.isConfirming || managerSummaryLoading) {
    return 'pending';
  }

  if (!hasManagerReady || !hasManagerDusdc) {
    return 'blocked';
  }

  return 'complete';
}

function getStrategyStatus({
  hasBestMarket,
  hasManagerDusdc,
  hasPreparedReview = false,
  hasSubmittedDigest = false,
}: {
  hasBestMarket: boolean;
  hasManagerDusdc: boolean;
  hasPreparedReview?: boolean;
  hasSubmittedDigest?: boolean;
}): JudgeDemoStepStatus {
  if (hasPreparedReview || hasSubmittedDigest) {
    return 'complete';
  }

  return hasBestMarket && hasManagerDusdc ? 'ready' : 'blocked';
}

function getDigestStatus({
  hasPreparedReview,
  hasSubmittedDigest,
  isFailed,
}: {
  hasPreparedReview: boolean;
  hasSubmittedDigest: boolean;
  isFailed: boolean;
}): JudgeDemoStepStatus {
  if (isFailed) {
    return 'failed';
  }

  if (hasSubmittedDigest) {
    return 'complete';
  }

  return hasPreparedReview ? 'ready' : 'blocked';
}

function getReconciliationStatus({
  hasSubmittedDigest,
  hasVerifiedProof,
  historyLoading,
}: {
  hasSubmittedDigest: boolean;
  hasVerifiedProof: boolean;
  historyLoading: boolean;
}): JudgeDemoStepStatus {
  if (hasVerifiedProof) {
    return 'complete';
  }

  if (!hasSubmittedDigest) {
    return 'blocked';
  }

  return historyLoading ? 'pending' : 'ready';
}

function getManagerFundingDescription({
  hasManagerDusdc,
  hasManagerReady,
  managerSummaryLoading,
}: {
  hasManagerDusdc: boolean;
  hasManagerReady: boolean;
  managerSummaryLoading: boolean;
}) {
  if (!hasManagerReady) {
    return 'Create or discover a reusable PredictManager for this wallet.';
  }

  if (managerSummaryLoading) {
    return 'Manager is ready. Loading DUSDC funding state.';
  }

  if (!hasManagerDusdc) {
    return 'Manager exists, but DUSDC funding is missing for a live mint demo.';
  }

  return 'PredictManager is ready and has DUSDC available for the demo path.';
}

function getVerdict({
  hasLiveReadiness,
  hasSubmittedDigest,
  hasVerifiedProof,
  isFailed,
  proofStatus,
}: {
  hasLiveReadiness: boolean;
  hasSubmittedDigest: boolean;
  hasVerifiedProof: boolean;
  isFailed: boolean;
  proofStatus: ProofVerdictStatus;
}): JudgeDemoVerdict {
  if (isFailed) {
    return 'Blocked';
  }

  if (hasVerifiedProof) {
    return 'Verified in app';
  }

  if (hasSubmittedDigest && proofStatus !== 'Pending Index') {
    return 'Chain confirmed';
  }

  if (hasSubmittedDigest) {
    return 'Pending index';
  }

  return hasLiveReadiness ? 'Ready for live demo' : 'Blocked';
}

function getVerdictSummary(verdict: JudgeDemoVerdict) {
  switch (verdict) {
    case 'Blocked':
      return 'One required prerequisite is missing. Follow the current step before claiming live proof.';
    case 'Chain confirmed':
      return 'A real digest exists. Finish app reconciliation before calling it verified.';
    case 'Pending index':
      return 'Chain proof exists, but Predict server portfolio or history still needs to catch up.';
    case 'Ready for live demo':
      return 'Prerequisites look ready. Open the strategy builder and produce a guarded execution review.';
    case 'Verified in app':
      return 'Digest proof and app reconciliation are visible. This is the clean judge endpoint.';
  }
}

function getVerdictTone(verdict: JudgeDemoVerdict): JudgeDemoPathViewModel['tone'] {
  switch (verdict) {
    case 'Blocked':
      return 'blocked';
    case 'Chain confirmed':
    case 'Pending index':
      return 'warning';
    case 'Ready for live demo':
      return 'empty';
    case 'Verified in app':
      return 'success';
  }
}

function buildEvidence({
  bestMarket,
  latestSubmittedProof,
  manager,
  managerSummary,
  proof,
  wallet,
}: {
  bestMarket: BestDemoMarketCandidate | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  manager: UsePredictManagerResult;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
  proof: ProofModeViewModel;
  wallet: WalletStatusModel;
}): JudgeDemoEvidenceItem[] {
  return [
    {
      label: 'Wallet',
      source: 'Wallet',
      value: wallet.isConnected
        ? (wallet.shortAddress ?? wallet.accountAddress ?? 'Connected')
        : 'Not connected',
    },
    {
      label: 'Network',
      source: 'Wallet',
      value: wallet.isConnected ? wallet.currentNetwork : wallet.expectedNetwork,
    },
    {
      label: 'Best market',
      source: 'Predict server',
      value:
        bestMarket === null
          ? 'No recommendation'
          : `${bestMarket.oracle.underlyingAsset} score ${bestMarket.marketQualityScore}`,
    },
    {
      label: 'Manager',
      source: 'Predict server',
      value:
        manager.managerId ?? (manager.requiresCreateManager ? 'Create needed' : manager.status),
    },
    {
      label: 'Manager DUSDC',
      source: 'Predict server',
      value:
        managerSummary === undefined
          ? 'Unavailable'
          : `${managerSummary.balanceSummary.tradingBalanceQuote.toString()} atomic`,
    },
    {
      label: 'Digest',
      source: 'Chain',
      value: latestSubmittedProof?.completedDigest ?? 'No submitted digest',
    },
    {
      label: 'Proof Center',
      source: 'Local',
      value: proof.status,
    },
  ];
}

function markCurrentStep(steps: JudgeDemoStep[]): JudgeDemoStep[] {
  const firstIncompleteIndex = steps.findIndex((candidate) => candidate.status !== 'complete');

  if (firstIncompleteIndex < 0) {
    return steps;
  }

  return steps.map((stepItem, index) =>
    index === firstIncompleteIndex && stepItem.status !== 'blocked' && stepItem.status !== 'failed'
      ? { ...stepItem, status: 'current' as const }
      : stepItem,
  );
}
