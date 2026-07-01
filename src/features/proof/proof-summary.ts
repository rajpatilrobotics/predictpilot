import { buildTxDigestExplorerUrl } from '@/lib/sui/explorer';
import type { TransactionDigest } from '@/types/predict';
import type { ProofPreparedReviewRecord, ProofSubmittedRecord } from './proof-session-context';
import type { ProofEvidenceRow, ProofModeViewModel } from './proof-selectors';

export type ProofSummaryMode = 'FAILED' | 'LIVE_TESTNET_PROOF' | 'LOCAL_PREVIEW_ONLY' | 'NO_PROOF';

export interface ProofSummaryModel {
  canCopy: boolean;
  description: string;
  mode: ProofSummaryMode;
  text: string;
  title: string;
}

export interface BuildProofSummaryOptions {
  generatedAtMs?: number;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  viewModel: ProofModeViewModel;
}

export function buildProofSummary({
  generatedAtMs,
  latestPreparedReview,
  latestSubmittedProof,
  viewModel,
}: BuildProofSummaryOptions): ProofSummaryModel {
  const activeRecord = latestSubmittedProof ?? latestPreparedReview;
  const mode = getSummaryMode(viewModel, latestPreparedReview, latestSubmittedProof);
  const digest = latestSubmittedProof?.completedDigest ?? null;
  const generatedAt = getGeneratedAt(activeRecord, generatedAtMs);
  const text = [
    'PREDICTPILOT PROOF SUMMARY',
    `Mode: ${formatMode(mode)}`,
    `Verdict: ${viewModel.status}`,
    `Network [W/C]: ${getRowValue(viewModel.readinessRows, 'Network')}`,
    `Wallet [W]: ${getRowValue(viewModel.readinessRows, 'Wallet')}`,
    `Action [L]: ${
      activeRecord === null ? 'No preview or submitted action' : formatAction(activeRecord.action)
    }`,
    `Manager [P/L]: ${activeRecord?.managerId ?? getRowValue(viewModel.readinessRows, 'PredictManager')}`,
    `Oracle [P/L]: ${activeRecord?.oracleId ?? 'Unavailable'}`,
    `Quantity [L]: ${formatOptionalBigInt(activeRecord?.quantityQuote)}`,
    `Amount [L]: ${formatOptionalBigInt(activeRecord?.amountQuote)}`,
    `PLP amount [L]: ${formatOptionalBigInt(activeRecord?.plpAmountAtomic)}`,
    `Simulation/preview [L]: ${getPreviewLine(latestPreparedReview)}`,
    `Digest [C]: ${digest ?? 'none'}`,
    `Explorer [C/L]: ${digest === null ? 'none' : buildTxDigestExplorerUrl(digest)}`,
    `Chain confirmation [C]: ${getRowValue(viewModel.reconciliationRows, 'Chain confirmation')}`,
    `Portfolio refresh [P]: ${getRowValue(viewModel.reconciliationRows, 'Portfolio refresh')}`,
    `History refresh [P]: ${getRowValue(viewModel.reconciliationRows, 'History reconciliation')}`,
    `Proof note: ${getProofNote(mode, viewModel.status, digest)}`,
    'Sources: [W]=Wallet [C]=Chain [P]=Predict server [L]=Local',
    `Generated at [L]: ${generatedAt}`,
  ].join('\n');

  return {
    canCopy: mode !== 'NO_PROOF',
    description: getSummaryDescription(mode),
    mode,
    text,
    title: getSummaryTitle(mode),
  };
}

function getSummaryMode(
  viewModel: ProofModeViewModel,
  latestPreparedReview: ProofPreparedReviewRecord | null,
  latestSubmittedProof: ProofSubmittedRecord | null,
): ProofSummaryMode {
  if (viewModel.status === 'Failed') {
    return 'FAILED';
  }

  if (latestSubmittedProof !== null) {
    return 'LIVE_TESTNET_PROOF';
  }

  if (latestPreparedReview !== null) {
    return 'LOCAL_PREVIEW_ONLY';
  }

  return 'NO_PROOF';
}

function getSummaryTitle(mode: ProofSummaryMode) {
  switch (mode) {
    case 'FAILED':
      return 'Proof summary failed';
    case 'LIVE_TESTNET_PROOF':
      return 'Copy proof summary';
    case 'LOCAL_PREVIEW_ONLY':
      return 'Copy preview summary';
    case 'NO_PROOF':
      return 'Proof summary unavailable';
  }
}

function getSummaryDescription(mode: ProofSummaryMode) {
  switch (mode) {
    case 'FAILED':
      return 'Copy the latest failed proof state without claiming verification.';
    case 'LIVE_TESTNET_PROOF':
      return 'Copy the latest submitted Testnet digest and reconciliation state.';
    case 'LOCAL_PREVIEW_ONLY':
      return 'Copy a local preview summary. This is not live Testnet proof.';
    case 'NO_PROOF':
      return 'Prepare or submit a guarded action before copying a proof summary.';
  }
}

function getProofNote(
  mode: ProofSummaryMode,
  status: ProofModeViewModel['status'],
  digest: TransactionDigest | null,
) {
  if (mode === 'NO_PROOF') {
    return 'No preview or executed Testnet action in this session.';
  }

  if (mode === 'LOCAL_PREVIEW_ONLY') {
    return 'Preview/simulation only. No onchain execution proof.';
  }

  if (mode === 'FAILED') {
    return 'No verified live proof for this action.';
  }

  if (digest !== null && status === 'Verified') {
    return 'Real Testnet transaction with visible Predict server reconciliation.';
  }

  return 'Chain digest exists. Indexed portfolio/history may still be catching up.';
}

function getPreviewLine(latestPreparedReview: ProofPreparedReviewRecord | null) {
  if (latestPreparedReview === null) {
    return 'No local simulation-ready review recorded';
  }

  return `${latestPreparedReview.simulationStatus} at ${new Date(
    latestPreparedReview.preparedAtMs,
  ).toISOString()}`;
}

function getGeneratedAt(
  activeRecord: ProofPreparedReviewRecord | ProofSubmittedRecord | null,
  generatedAtMs: number | undefined,
) {
  if (activeRecord === null || generatedAtMs === undefined) {
    return 'Not generated yet';
  }

  return new Date(generatedAtMs).toISOString();
}

function getRowValue(rows: ProofEvidenceRow[], label: string) {
  return rows.find((row) => row.label === label)?.value ?? 'Unavailable';
}

function formatAction(action: string) {
  return action
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatMode(mode: ProofSummaryMode) {
  return mode.replaceAll('_', ' ');
}

function formatOptionalBigInt(value: bigint | undefined) {
  return value === undefined ? 'not provided' : value.toString();
}
