import { predictDeploymentConfig } from '@/config/predict';
import type { RiskPreviewProps } from '@/features/tx/RiskPreview';
import {
  createPayoffSnapshotFromPreview,
  type PayoffVisualizerSnapshot,
  type PayoffVisualizerWarning,
} from '@/features/trade/payoff-visualizer';
import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictPilotError } from '@/lib/errors';
import {
  formatObjectId,
  formatPrice1e9,
  formatQuoteAmount,
  formatSafeIsoTimestamp,
} from '@/lib/formatters';
import type { TransactionDigest } from '@/types/predict';
import type { ProofPreparedReviewRecord, ProofSubmittedRecord } from './proof-session-context';
import type { ProofEvidenceSource, ProofModeViewModel } from './proof-selectors';

export type StrategyReceiptState =
  | 'draft'
  | 'failed'
  | 'pending_index'
  | 'simulation_ready'
  | 'submitted'
  | 'verified';

export type StrategyReceiptSource = ProofEvidenceSource;

export interface StrategyReceiptRow {
  label: string;
  source: StrategyReceiptSource;
  value: string;
}

export interface StrategyReceiptWarning {
  level: 'blocked' | 'caution' | 'info';
  message: string;
  source: StrategyReceiptSource;
}

export interface StrategyReceiptModel {
  description: string;
  digest: TransactionDigest | null;
  evidenceRows: StrategyReceiptRow[];
  identityRows: StrategyReceiptRow[];
  reconciliationRows: StrategyReceiptRow[];
  sourceLabels: StrategyReceiptSource[];
  state: StrategyReceiptState;
  title: string;
  verdict: string;
  warnings: StrategyReceiptWarning[];
}

export interface BuildDraftStrategyReceiptOptions {
  network?: string | null;
  payoffSnapshot: PayoffVisualizerSnapshot;
  sender?: string | null;
}

export interface BuildExecutionStrategyReceiptOptions {
  completedDigest?: string | null;
  executionError?: PredictPilotError | null;
  preview: PredictPtbSimulationPreview;
  risk?: RiskPreviewProps['preview'];
}

export interface BuildProofStrategyReceiptOptions {
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  viewModel: ProofModeViewModel;
}

export function buildDraftStrategyReceipt({
  network,
  payoffSnapshot,
  sender,
}: BuildDraftStrategyReceiptOptions): StrategyReceiptModel {
  return {
    description:
      'Local strategy receipt only. No wallet transaction has been submitted and no live proof exists yet.',
    digest: null,
    evidenceRows: [
      {
        label: 'Simulation',
        source: 'Local',
        value: 'Not run yet',
      },
      {
        label: 'Proof status',
        source: 'Local',
        value: 'No live proof yet',
      },
    ],
    identityRows: createSnapshotRows(payoffSnapshot, {
      network: network ?? predictDeploymentConfig.network,
      sender,
    }),
    reconciliationRows: [
      {
        label: 'Portfolio refresh',
        source: 'Predict server',
        value: 'Not submitted',
      },
      {
        label: 'History refresh',
        source: 'Predict server',
        value: 'Not submitted',
      },
    ],
    sourceLabels: ['Local'],
    state: 'draft',
    title: createReceiptTitle(payoffSnapshot.action),
    verdict: 'Draft strategy',
    warnings: normalizePayoffWarnings(payoffSnapshot.warnings),
  };
}

export function buildExecutionStrategyReceipt({
  completedDigest,
  executionError,
  preview,
  risk,
}: BuildExecutionStrategyReceiptOptions): StrategyReceiptModel {
  const payoffSnapshot = createPayoffSnapshotFromPreview(risk);
  const digest = normalizeDigest(completedDigest);
  const state = selectExecutionReceiptState({ digest, executionError, preview });
  const warnings = [
    ...normalizePayoffWarnings(payoffSnapshot?.warnings),
    ...preview.intent.warnings.map((message) => ({
      level: 'caution' as const,
      message,
      source: 'Local' as const,
    })),
    ...('simulation' in preview
      ? preview.simulation.warnings.map((message) => ({
          level: 'caution' as const,
          message,
          source: 'Chain' as const,
        }))
      : []),
    ...(executionError === null || executionError === undefined
      ? []
      : [
          {
            level: 'blocked' as const,
            message: executionError.message,
            source: 'Wallet' as const,
          },
        ]),
  ];

  return {
    description: getReceiptDescription(state),
    digest,
    evidenceRows: [
      {
        label: 'Simulation',
        source: 'Chain',
        value: formatSimulationStatus(preview),
      },
      {
        label: 'Wallet submission',
        source: digest === null ? 'Wallet' : 'Chain',
        value: digest === null ? getWalletSubmissionCopy(state) : 'Submitted to Sui Testnet',
      },
      {
        label: 'Proof status',
        source: digest === null ? 'Local' : 'Chain',
        value: getProofStatusCopy(state),
      },
    ],
    identityRows: payoffSnapshot
      ? createSnapshotRows(payoffSnapshot, {
          managerId: preview.intent.managerId,
          network: preview.intent.configIds.network,
          oracleId: preview.intent.oracleId,
          sender: preview.intent.sender,
        })
      : createIntentRows(preview),
    reconciliationRows: [
      {
        label: 'Portfolio refresh',
        source: 'Predict server',
        value: digest === null ? 'Not submitted' : 'Pending post-submit refresh',
      },
      {
        label: 'History refresh',
        source: 'Predict server',
        value: digest === null ? 'Not submitted' : 'Pending index',
      },
    ],
    sourceLabels: uniqueSources([
      'Local',
      'Wallet',
      ...(digest === null ? [] : (['Chain'] satisfies StrategyReceiptSource[])),
    ]),
    state,
    title: createReceiptTitle(preview.intent.action),
    verdict: getVerdictCopy(state),
    warnings: dedupeReceiptWarnings(warnings),
  };
}

export function buildProofStrategyReceipt({
  latestPreparedReview,
  latestSubmittedProof,
  viewModel,
}: BuildProofStrategyReceiptOptions): StrategyReceiptModel {
  const submitted = latestSubmittedProof;
  const prepared = latestPreparedReview;
  const digest = submitted?.completedDigest ?? viewModel.digest;
  const payoffSnapshot = submitted?.payoffSnapshot ?? prepared?.payoffSnapshot ?? null;
  const state = selectProofReceiptState(viewModel);
  const action = submitted?.action ?? prepared?.action ?? 'UNKNOWN_ACTION';
  const refreshWarning = submitted?.refreshWarning;

  return {
    description: getReceiptDescription(state),
    digest,
    evidenceRows: [
      {
        label: 'Submitted digest',
        source: digest === null ? 'Local' : 'Chain',
        value: digest === null ? 'No submitted digest' : 'Submitted to Sui Testnet',
      },
      {
        label: 'Proof verdict',
        source: viewModel.digest === null ? 'Local' : 'Chain',
        value: viewModel.status,
      },
      {
        label: 'Indexed match',
        source: 'Predict server',
        value:
          viewModel.matchedHistoryDigest === null
            ? digest === null
              ? 'No submitted proof'
              : 'Pending index'
            : 'History matched digest',
      },
    ],
    identityRows:
      payoffSnapshot === null
        ? createSessionRows({ action, prepared, submitted, viewModel })
        : createSnapshotRows(payoffSnapshot, {
            managerId: submitted?.managerId ?? prepared?.managerId,
            network: predictDeploymentConfig.network,
            oracleId: submitted?.oracleId ?? prepared?.oracleId,
            sender: submitted?.sender ?? prepared?.sender,
          }),
    reconciliationRows: [
      {
        label: 'Portfolio refresh',
        source: 'Predict server',
        value: viewModel.status === 'Verified' ? 'Visible after digest' : 'Pending or unavailable',
      },
      {
        label: 'History refresh',
        source: 'Predict server',
        value:
          viewModel.matchedHistoryDigest === null ? 'Awaiting matching history' : 'Matched digest',
      },
      {
        label: 'Refresh warning',
        source: 'Predict server',
        value:
          refreshWarning === null || refreshWarning === undefined ? 'None' : refreshWarning.message,
      },
    ],
    sourceLabels: viewModel.sourceLabels.map((label) => label.label),
    state,
    title: createReceiptTitle(action),
    verdict: getVerdictCopy(state),
    warnings: dedupeReceiptWarnings([
      ...normalizePayoffWarnings(payoffSnapshot?.warnings),
      ...(refreshWarning === null || refreshWarning === undefined
        ? []
        : [
            {
              level: 'caution' as const,
              message: refreshWarning.message,
              source: 'Predict server' as const,
            },
          ]),
    ]),
  };
}

function selectExecutionReceiptState({
  digest,
  executionError,
  preview,
}: {
  digest: TransactionDigest | null;
  executionError?: PredictPilotError | null;
  preview: PredictPtbSimulationPreview;
}): StrategyReceiptState {
  if (executionError !== null && executionError !== undefined && digest === null) {
    return 'failed';
  }

  if (digest !== null) {
    return executionError === null || executionError === undefined ? 'submitted' : 'failed';
  }

  return preview.status === 'ready'
    ? 'simulation_ready'
    : preview.status === 'loading'
      ? 'draft'
      : 'failed';
}

function selectProofReceiptState(viewModel: ProofModeViewModel): StrategyReceiptState {
  switch (viewModel.status) {
    case 'Verified':
      return 'verified';
    case 'Pending Index':
      return 'pending_index';
    case 'Failed':
      return 'failed';
    case 'Ready but Not Submitted':
      return 'simulation_ready';
    case 'Blocked':
    case 'Ready':
      return 'draft';
  }
}

function createSnapshotRows(
  snapshot: PayoffVisualizerSnapshot,
  context: {
    managerId?: string | null;
    network?: string | null;
    oracleId?: string | null;
    sender?: string | null;
  } = {},
): StrategyReceiptRow[] {
  const strikeOrRange =
    snapshot.kind === 'binary'
      ? formatOptionalStrike(snapshot.strike1e9)
      : `${formatOptionalStrike(snapshot.lowerStrike1e9)} to ${formatOptionalStrike(
          snapshot.higherStrike1e9,
        )}`;

  return [
    {
      label: 'Action',
      source: 'Local',
      value: formatAction(snapshot.action),
    },
    {
      label: 'Network',
      source: 'Local',
      value: context.network ?? predictDeploymentConfig.network,
    },
    {
      label: 'Wallet',
      source: 'Wallet',
      value: formatNullableObject(context.sender),
    },
    {
      label: 'Manager',
      source: 'Predict server',
      value: formatNullableObject(context.managerId ?? snapshot.managerId),
    },
    {
      label: 'Oracle',
      source: 'Predict server',
      value: formatNullableObject(context.oracleId ?? snapshot.oracleId),
    },
    {
      label: 'Underlying',
      source: 'Predict server',
      value: snapshot.underlyingAsset ?? 'Unavailable / TODO VERIFY',
    },
    {
      label: snapshot.kind === 'binary' ? 'Direction / strike' : 'Range',
      source: 'Local',
      value:
        snapshot.kind === 'binary'
          ? `${snapshot.direction ?? 'TODO VERIFY'} @ ${strikeOrRange}`
          : strikeOrRange,
    },
    {
      label: 'Quantity',
      source: 'Local',
      value:
        snapshot.quantityQuote === undefined
          ? 'Unavailable / TODO VERIFY'
          : formatQuoteAmount(snapshot.quantityQuote, snapshot.quoteAssetSymbol),
    },
    {
      label: 'Expiry',
      source: 'Predict server',
      value:
        snapshot.expiryMs === undefined
          ? 'Unavailable / TODO VERIFY'
          : formatExpiry(snapshot.expiryMs),
    },
    {
      label: 'DUSDC amount',
      source: 'Local',
      value:
        snapshot.estimatedCostQuote !== undefined
          ? formatQuoteAmount(snapshot.estimatedCostQuote, snapshot.quoteAssetSymbol)
          : snapshot.estimatedPayoutQuote !== undefined
            ? formatQuoteAmount(snapshot.estimatedPayoutQuote, snapshot.quoteAssetSymbol)
            : 'Simulation required',
    },
  ];
}

function createIntentRows(preview: PredictPtbSimulationPreview): StrategyReceiptRow[] {
  return [
    {
      label: 'Action',
      source: 'Local',
      value: formatAction(preview.intent.action),
    },
    {
      label: 'Network',
      source: 'Local',
      value: preview.intent.configIds.network,
    },
    {
      label: 'Wallet',
      source: 'Wallet',
      value: formatNullableObject(preview.intent.sender),
    },
    {
      label: 'Manager',
      source: 'Predict server',
      value: formatNullableObject(preview.intent.managerId),
    },
    {
      label: 'Oracle',
      source: 'Predict server',
      value: formatNullableObject(preview.intent.oracleId),
    },
    {
      label: 'DUSDC amount',
      source: 'Local',
      value:
        preview.intent.expectedCostQuote !== undefined
          ? formatQuoteAmount(preview.intent.expectedCostQuote)
          : preview.intent.expectedPayoutQuote !== undefined
            ? formatQuoteAmount(preview.intent.expectedPayoutQuote)
            : 'Simulation required',
    },
  ];
}

function createSessionRows({
  action,
  prepared,
  submitted,
}: {
  action: string;
  prepared: ProofPreparedReviewRecord | null;
  submitted: ProofSubmittedRecord | null;
  viewModel: ProofModeViewModel;
}): StrategyReceiptRow[] {
  return [
    {
      label: 'Action',
      source: 'Local',
      value: formatAction(action),
    },
    {
      label: 'Network',
      source: 'Local',
      value: predictDeploymentConfig.network,
    },
    {
      label: 'Wallet',
      source: 'Wallet',
      value: formatNullableObject(submitted?.sender ?? prepared?.sender),
    },
    {
      label: 'Manager',
      source: 'Predict server',
      value: formatNullableObject(submitted?.managerId ?? prepared?.managerId),
    },
    {
      label: 'Oracle',
      source: 'Predict server',
      value: formatNullableObject(submitted?.oracleId ?? prepared?.oracleId),
    },
    {
      label: 'Quantity',
      source: 'Local',
      value:
        submitted?.quantityQuote !== undefined
          ? formatQuoteAmount(submitted.quantityQuote)
          : prepared?.quantityQuote !== undefined
            ? formatQuoteAmount(prepared.quantityQuote)
            : 'Unavailable / TODO VERIFY',
    },
  ];
}

function normalizePayoffWarnings(
  warnings: PayoffVisualizerWarning[] | null | undefined,
): StrategyReceiptWarning[] {
  return (warnings ?? []).map((warning) => ({
    level: warning.level === 'blocked' ? 'blocked' : 'caution',
    message: warning.message,
    source: 'Local',
  }));
}

function formatSimulationStatus(preview: PredictPtbSimulationPreview) {
  if (preview.status === 'ready') {
    return 'Simulation ready';
  }

  if (preview.status === 'loading') {
    return 'Simulation loading';
  }

  if ('error' in preview) {
    return preview.error.title;
  }

  return 'Simulation unavailable';
}

function getWalletSubmissionCopy(state: StrategyReceiptState) {
  if (state === 'failed') {
    return 'Not submitted';
  }

  if (state === 'simulation_ready') {
    return 'Ready for wallet signature';
  }

  return 'No wallet submission';
}

function getProofStatusCopy(state: StrategyReceiptState) {
  switch (state) {
    case 'draft':
      return 'No live proof yet';
    case 'failed':
      return 'Failed stage';
    case 'pending_index':
      return 'Pending index';
    case 'simulation_ready':
      return 'Simulation ready';
    case 'submitted':
      return 'Submitted, not yet reconciled';
    case 'verified':
      return 'Verified by digest and indexed reconciliation';
  }
}

function getVerdictCopy(state: StrategyReceiptState) {
  switch (state) {
    case 'draft':
      return 'No live proof yet';
    case 'failed':
      return 'Failed';
    case 'pending_index':
      return 'Pending index';
    case 'simulation_ready':
      return 'Simulation ready';
    case 'submitted':
      return 'Submitted to Sui Testnet';
    case 'verified':
      return 'Verified';
  }
}

function getReceiptDescription(state: StrategyReceiptState) {
  switch (state) {
    case 'draft':
      return 'This receipt summarizes local inputs only. It is not execution proof.';
    case 'failed':
      return 'The latest review or submission failed. Do not treat this receipt as proof unless a digest is shown.';
    case 'pending_index':
      return 'A real digest exists, but Predict server portfolio/history reconciliation is still pending.';
    case 'simulation_ready':
      return 'Simulation is ready. No wallet transaction has been submitted yet.';
    case 'submitted':
      return 'A real digest was submitted to Sui Testnet. Indexed reconciliation may still be catching up.';
    case 'verified':
      return 'A real digest is present and Proof Mode found matching indexed reconciliation.';
  }
}

function createReceiptTitle(action: string) {
  return `${formatAction(action)} strategy receipt`;
}

function normalizeDigest(value: string | null | undefined): TransactionDigest | null {
  return value === null || value === undefined || value.trim() === '' ? null : value;
}

function formatNullableObject(value: string | null | undefined) {
  return value === null || value === undefined || value === ''
    ? 'Unavailable / TODO VERIFY'
    : formatObjectId(value);
}

function formatOptionalStrike(value: bigint | undefined) {
  return value === undefined ? 'Unavailable / TODO VERIFY' : formatPrice1e9(value);
}

function formatExpiry(value: bigint | number) {
  return formatSafeIsoTimestamp(typeof value === 'bigint' ? value : BigInt(value));
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueSources(sources: StrategyReceiptSource[]) {
  return [...new Set(sources)];
}

function dedupeReceiptWarnings(warnings: StrategyReceiptWarning[]) {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.level}:${warning.source}:${warning.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
