import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type {
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import type { TransactionDigest } from '@/types/predict';
import type { ProtocolHistoryRecord } from '@/types/history';
import type { PredictTransactionAction } from '@/types/tx';
import type { ProofPreparedReviewRecord, ProofSubmittedRecord } from './proof-session-context';
import type { TransactionHistoryTimelineModel } from '@/features/history/lib/history-selectors';

export type ProofEvidenceSource = 'Chain' | 'Local' | 'Predict server' | 'Wallet';

export type ProofVerdictStatus =
  | 'Blocked'
  | 'Failed'
  | 'Pending Index'
  | 'Ready'
  | 'Ready but Not Submitted'
  | 'Verified';

export type ProofRowStatus = 'blocked' | 'failed' | 'info' | 'pass' | 'pending';

export interface ProofEvidenceRow {
  label: string;
  source: ProofEvidenceSource;
  status: ProofRowStatus;
  value: string;
}

export interface ProofSourceLabel {
  label: ProofEvidenceSource;
  status: ProofRowStatus;
}

export interface ProofModeViewModel {
  digest: TransactionDigest | null;
  executionRows: ProofEvidenceRow[];
  explanation: string;
  indexedSourceValue: string;
  matchedHistoryDigest: TransactionDigest | null;
  reconciliationRows: ProofEvidenceRow[];
  readinessRows: ProofEvidenceRow[];
  sourceLabels: ProofSourceLabel[];
  status: ProofVerdictStatus;
  tone: 'blocked' | 'empty' | 'error' | 'success' | 'warning';
  title: string;
}

export interface SelectProofModeViewModelOptions {
  history: TransactionHistoryTimelineModel | undefined;
  historyError: PredictPilotError | null;
  historyLoading: boolean;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  manager: UsePredictManagerResult;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
  managerSummaryError: PredictPilotError | null;
  managerSummaryLoading: boolean;
  positions: NormalizedManagerPositionsSummaryModel | undefined;
  positionsError: PredictPilotError | null;
  positionsLoading: boolean;
  wallet: WalletStatusModel;
}

export function selectProofModeViewModel({
  history,
  historyError,
  historyLoading,
  latestPreparedReview,
  latestSubmittedProof,
  manager,
  managerSummary,
  managerSummaryError,
  managerSummaryLoading,
  positions,
  positionsError,
  positionsLoading,
  wallet,
}: SelectProofModeViewModelOptions): ProofModeViewModel {
  const historyMatch = findMatchingHistoryRecord(history?.records ?? [], latestSubmittedProof);
  const managerFundingMatch = findManagerFundingSummaryMatch({
    latestSubmittedProof,
    managerSummary,
  });
  const error = manager.error ?? managerSummaryError ?? positionsError ?? historyError;
  const readinessRows = buildReadinessRows({
    error,
    manager,
    managerSummary,
    managerSummaryLoading,
    positions,
    positionsLoading,
    wallet,
  });
  const executionRows = buildExecutionRows({
    historyMatch,
    latestPreparedReview,
    latestSubmittedProof,
    managerFundingMatch,
  });
  const reconciliationRows = buildReconciliationRows({
    history,
    historyLoading,
    historyMatch,
    latestSubmittedProof,
    managerFundingMatch,
    managerSummary,
    managerSummaryLoading,
    positions,
    positionsLoading,
  });
  const status = selectVerdictStatus({
    error,
    historyMatch,
    latestPreparedReview,
    latestSubmittedProof,
    managerFundingMatch,
    manager,
    wallet,
  });
  const sourceLabels = buildSourceLabels({
    historyMatch,
    latestPreparedReview,
    latestSubmittedProof,
    manager,
    wallet,
  });

  return {
    digest: latestSubmittedProof?.completedDigest ?? historyMatch?.digest ?? null,
    executionRows,
    explanation: getVerdictExplanation(status),
    indexedSourceValue: getIndexedSourceValue({ historyMatch, latestSubmittedProof, managerFundingMatch }),
    matchedHistoryDigest: historyMatch?.digest ?? null,
    reconciliationRows,
    readinessRows,
    sourceLabels,
    status,
    title: getVerdictTitle(status),
    tone: getVerdictTone(status),
  };
}

function selectVerdictStatus({
  error,
  historyMatch,
  latestPreparedReview,
  latestSubmittedProof,
  managerFundingMatch,
  manager,
  wallet,
}: {
  error: PredictPilotError | null;
  historyMatch: ProtocolHistoryRecord | null;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  managerFundingMatch: ManagerFundingSummaryMatch | null;
  manager: UsePredictManagerResult;
  wallet: WalletStatusModel;
}): ProofVerdictStatus {
  if (error !== null || latestSubmittedProof?.confirmedStatus === 'failure') {
    return 'Failed';
  }

  if (!wallet.isConnected || wallet.isWrongNetwork || !manager.isReady) {
    return 'Blocked';
  }

  if (latestSubmittedProof === null) {
    return latestPreparedReview === null ? 'Ready' : 'Ready but Not Submitted';
  }

  if (historyMatch === null && managerFundingMatch === null) {
    return 'Pending Index';
  }

  return 'Verified';
}

function buildReadinessRows({
  error,
  manager,
  managerSummary,
  managerSummaryLoading,
  positions,
  positionsLoading,
  wallet,
}: {
  error: PredictPilotError | null;
  manager: UsePredictManagerResult;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
  managerSummaryLoading: boolean;
  positions: NormalizedManagerPositionsSummaryModel | undefined;
  positionsLoading: boolean;
  wallet: WalletStatusModel;
}): ProofEvidenceRow[] {
  return [
    {
      label: 'Wallet',
      source: 'Wallet',
      status: wallet.isConnected ? 'pass' : 'blocked',
      value: wallet.isConnected
        ? `${wallet.walletName ?? 'Wallet'} ${wallet.shortAddress ?? ''}`.trim()
        : 'Connect a Sui wallet',
    },
    {
      label: 'Network',
      source: 'Wallet',
      status: wallet.isWrongNetwork ? 'blocked' : wallet.isConnected ? 'pass' : 'pending',
      value: wallet.isWrongNetwork
        ? `Switch to ${wallet.expectedNetwork}`
        : wallet.isConnected
          ? wallet.currentNetwork
          : wallet.expectedNetwork,
    },
    {
      label: 'PredictManager',
      source: 'Predict server',
      status: manager.isReady
        ? 'pass'
        : manager.isLoading || manager.isConfirming
          ? 'pending'
          : 'blocked',
      value: getManagerReadinessValue(manager),
    },
    {
      label: 'Manager balance',
      source: 'Predict server',
      status: managerSummary === undefined ? (managerSummaryLoading ? 'pending' : 'info') : 'pass',
      value:
        managerSummary === undefined
          ? managerSummaryLoading
            ? 'Loading manager summary'
            : 'Unavailable until manager is ready'
          : `${managerSummary.balanceSummary.totalManagerBalanceQuote.toString()} atomic DUSDC`,
    },
    {
      label: 'Positions',
      source: 'Predict server',
      status: positions === undefined ? (positionsLoading ? 'pending' : 'info') : 'pass',
      value:
        positions === undefined
          ? positionsLoading
            ? 'Loading positions'
            : 'Unavailable until manager is ready'
          : `${positions.openBinaryPositionCount + positions.openRangePositionCount} open`,
    },
    ...(error === null
      ? []
      : [
          {
            label: 'Read error',
            source: 'Local' as const,
            status: 'failed' as const,
            value: error.message,
          },
        ]),
  ];
}

function buildExecutionRows({
  historyMatch,
  latestPreparedReview,
  latestSubmittedProof,
  managerFundingMatch,
}: {
  historyMatch: ProtocolHistoryRecord | null;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  managerFundingMatch: ManagerFundingSummaryMatch | null;
}): ProofEvidenceRow[] {
  const activeRecord = latestSubmittedProof ?? latestPreparedReview;

  return [
    {
      label: 'Action',
      source: activeRecord === null ? 'Local' : latestSubmittedProof === null ? 'Local' : 'Chain',
      status: activeRecord === null ? 'info' : 'pass',
      value:
        activeRecord === null ? 'No submitted transaction yet' : formatAction(activeRecord.action),
    },
    {
      label: 'Sender',
      source: activeRecord === null ? 'Local' : 'Wallet',
      status: activeRecord === null ? 'info' : 'pass',
      value: activeRecord?.sender ?? 'No wallet submission yet',
    },
    {
      label: 'Digest',
      source: latestSubmittedProof === null ? 'Local' : 'Chain',
      status: latestSubmittedProof === null ? 'pending' : 'pass',
      value: latestSubmittedProof?.completedDigest ?? 'Digest appears only after wallet submission',
    },
    {
      label: isManagerFundingAction(latestSubmittedProof?.action) ? 'Manager refresh' : 'Indexed match',
      source: 'Predict server',
      status: historyMatch === null && managerFundingMatch === null ? 'pending' : 'pass',
      value:
        historyMatch !== null
          ? historyMatch.digest
          : managerFundingMatch !== null
            ? 'Manager summary refreshed after digest'
            : isManagerFundingAction(latestSubmittedProof?.action)
              ? 'Waiting for manager summary refresh'
              : 'Waiting for matching history row',
    },
    {
      label: 'Prepared review',
      source: 'Local',
      status: latestPreparedReview === null ? 'info' : 'pass',
      value:
        latestPreparedReview === null
          ? 'No local simulation-ready review recorded'
          : `${latestPreparedReview.simulationStatus} at ${formatTimestamp(latestPreparedReview.preparedAtMs)}`,
    },
  ];
}

function buildReconciliationRows({
  history,
  historyLoading,
  historyMatch,
  latestSubmittedProof,
  managerFundingMatch,
  managerSummary,
  managerSummaryLoading,
  positions,
  positionsLoading,
}: {
  history: TransactionHistoryTimelineModel | undefined;
  historyLoading: boolean;
  historyMatch: ProtocolHistoryRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  managerFundingMatch: ManagerFundingSummaryMatch | null;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
  managerSummaryLoading: boolean;
  positions: NormalizedManagerPositionsSummaryModel | undefined;
  positionsLoading: boolean;
}): ProofEvidenceRow[] {
  return [
    {
      label: 'Chain confirmation',
      source: 'Chain',
      status:
        latestSubmittedProof === null
          ? 'pending'
          : latestSubmittedProof.confirmedStatus === 'success'
            ? 'pass'
            : 'pending',
      value: latestSubmittedProof?.confirmedStatus ?? 'No submitted digest',
    },
    {
      label: 'History reconciliation',
      source: 'Predict server',
      status:
        historyMatch !== null || managerFundingMatch !== null
          ? 'pass'
          : historyLoading || managerSummaryLoading
            ? 'pending'
            : 'blocked',
      value:
        historyMatch !== null
          ? `${historyMatch.kind} indexed`
          : managerFundingMatch !== null
            ? 'Manager summary refreshed after funding digest'
            : isManagerFundingAction(latestSubmittedProof?.action)
              ? managerSummaryLoading
                ? 'Refreshing manager summary'
                : 'No manager summary refresh yet'
              : historyLoading
                ? 'Refreshing history'
                : 'No matching history row yet',
    },
    {
      label: 'Portfolio refresh',
      source: 'Predict server',
      status: managerSummary === undefined ? (managerSummaryLoading ? 'pending' : 'info') : 'pass',
      value:
        managerSummary === undefined
          ? managerSummaryLoading
            ? 'Refreshing manager summary'
            : 'Manager summary unavailable'
          : 'Manager summary loaded',
    },
    {
      label: 'Position refresh',
      source: 'Predict server',
      status: positions === undefined ? (positionsLoading ? 'pending' : 'info') : 'pass',
      value:
        positions === undefined
          ? positionsLoading
            ? 'Refreshing positions'
            : 'Position summary unavailable'
          : `${positions.binaryPositionCount + positions.rangePositionCount} positions loaded`,
    },
    {
      label: 'History rows',
      source: 'Predict server',
      status: history === undefined ? (historyLoading ? 'pending' : 'info') : 'pass',
      value: history === undefined ? 'History not loaded' : `${history.totalCount} rows available`,
    },
    ...(latestSubmittedProof?.refreshWarning === undefined ||
    latestSubmittedProof.refreshWarning === null
      ? []
      : [
          {
            label: 'Refresh warning',
            source: 'Local' as const,
            status: 'pending' as const,
            value: latestSubmittedProof.refreshWarning.message,
          },
        ]),
  ];
}

function buildSourceLabels({
  historyMatch,
  latestPreparedReview,
  latestSubmittedProof,
  manager,
  wallet,
}: {
  historyMatch: ProtocolHistoryRecord | null;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  manager: UsePredictManagerResult;
  wallet: WalletStatusModel;
}): ProofSourceLabel[] {
  return [
    {
      label: 'Wallet',
      status: wallet.isConnected && !wallet.isWrongNetwork ? 'pass' : 'blocked',
    },
    {
      label: 'Chain',
      status: latestSubmittedProof === null ? 'pending' : 'pass',
    },
    {
      label: 'Predict server',
      status: historyMatch !== null || manager.isReady ? 'pass' : 'pending',
    },
    {
      label: 'Local',
      status: latestPreparedReview !== null || latestSubmittedProof !== null ? 'pass' : 'info',
    },
  ];
}

function findMatchingHistoryRecord(
  records: ProtocolHistoryRecord[],
  latestSubmittedProof: ProofSubmittedRecord | null,
) {
  if (latestSubmittedProof === null) {
    return null;
  }

  return records.find((record) => record.digest === latestSubmittedProof.completedDigest) ?? null;
}

interface ManagerFundingSummaryMatch {
  managerId: string;
}

function findManagerFundingSummaryMatch({
  latestSubmittedProof,
  managerSummary,
}: {
  latestSubmittedProof: ProofSubmittedRecord | null;
  managerSummary: ManagerSummaryPortfolioModel | undefined;
}): ManagerFundingSummaryMatch | null {
  if (
    latestSubmittedProof === null ||
    !isManagerFundingAction(latestSubmittedProof.action) ||
    latestSubmittedProof.confirmedStatus !== 'success' ||
    latestSubmittedProof.managerId === null ||
    managerSummary === undefined ||
    managerSummary.balanceSummary.managerId !== latestSubmittedProof.managerId
  ) {
    return null;
  }

  return { managerId: latestSubmittedProof.managerId };
}

function isManagerFundingAction(action: ProofSubmittedRecord['action'] | undefined) {
  return action === 'DEPOSIT_QUOTE' || action === 'WITHDRAW_QUOTE';
}

function getIndexedSourceValue({
  historyMatch,
  latestSubmittedProof,
  managerFundingMatch,
}: {
  historyMatch: ProtocolHistoryRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  managerFundingMatch: ManagerFundingSummaryMatch | null;
}) {
  if (historyMatch !== null) {
    return 'Predict server matched';
  }

  if (managerFundingMatch !== null) {
    return 'Manager summary refreshed';
  }

  return isManagerFundingAction(latestSubmittedProof?.action)
    ? 'Awaiting manager summary refresh'
    : 'Awaiting matching history';
}

function getManagerReadinessValue(manager: UsePredictManagerResult): string {
  if (manager.isReady && manager.managerId !== null) {
    return manager.managerId;
  }

  if (manager.isLoading) {
    return 'Loading indexed managers';
  }

  if (manager.isConfirming) {
    return 'Confirming onchain object';
  }

  if (manager.isAmbiguous) {
    return 'Multiple managers found';
  }

  if (manager.requiresCreateManager) {
    return 'Create manager first';
  }

  return manager.status;
}

function formatAction(action: PredictTransactionAction): string {
  return action
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(timestampMs));
}

function getVerdictTitle(status: ProofVerdictStatus): string {
  switch (status) {
    case 'Blocked':
      return 'Proof blocked';
    case 'Failed':
      return 'Proof failed';
    case 'Pending Index':
      return 'Chain proof pending index';
    case 'Ready':
      return 'Ready for first proof';
    case 'Ready but Not Submitted':
      return 'Review ready, not submitted';
    case 'Verified':
      return 'Proof verified';
  }
}

function getVerdictExplanation(status: ProofVerdictStatus): string {
  switch (status) {
    case 'Blocked':
      return 'Connect a Testnet wallet and confirm one PredictManager before Proof Center can verify execution.';
    case 'Failed':
      return 'A wallet, read, transaction, or refresh error is blocking this proof checkpoint.';
    case 'Pending Index':
      return 'A chain digest exists, but Predict server history or portfolio refresh has not reconciled it yet.';
    case 'Ready':
      return 'Wallet, Testnet, and manager readiness can be checked here. Submit a guarded PTB to create digest proof.';
    case 'Ready but Not Submitted':
      return 'A local simulation-ready review exists, but it is not proof until a wallet submission returns a digest.';
    case 'Verified':
      return 'The digest exists and the required Predict server reconciliation is visible.';
  }
}

function getVerdictTone(status: ProofVerdictStatus): ProofModeViewModel['tone'] {
  switch (status) {
    case 'Blocked':
      return 'blocked';
    case 'Failed':
      return 'error';
    case 'Pending Index':
      return 'warning';
    case 'Ready':
    case 'Ready but Not Submitted':
      return 'empty';
    case 'Verified':
      return 'success';
  }
}
