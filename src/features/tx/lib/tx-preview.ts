import type {
  PredictPtbSimulationPreview,
  PredictSimulationAsset,
  PredictSimulationIntent,
} from '@/integrations/deepbook-predict/tx/simulate';

export interface PredictTxPreviewSummaryRow {
  label: string;
  value: string;
}

export interface PredictTxPreviewViewModel {
  action: string;
  canRequestSignature: boolean;
  recoveryCopy?: string;
  rows: PredictTxPreviewSummaryRow[];
  status: PredictPtbSimulationPreview['status'];
  statusCopy: string;
  title: string;
  warnings: string[];
}

export function toPredictTxPreviewViewModel(
  preview: PredictPtbSimulationPreview,
): PredictTxPreviewViewModel {
  return {
    action: preview.intent.action,
    canRequestSignature: isPredictTxPreviewReady(preview),
    ...(getPredictTxPreviewRecoveryCopy(preview) === undefined
      ? {}
      : { recoveryCopy: getPredictTxPreviewRecoveryCopy(preview) }),
    rows: createPredictTxPreviewRows(preview),
    status: preview.status,
    statusCopy: getPredictTxPreviewStatusCopy(preview),
    title: getPredictTxPreviewTitle(preview.intent),
    warnings: getPredictTxPreviewWarnings(preview),
  };
}

export function isPredictTxPreviewReady(preview: PredictPtbSimulationPreview): boolean {
  return preview.status === 'ready';
}

export function getPredictTxPreviewStatusCopy(preview: PredictPtbSimulationPreview): string {
  switch (preview.status) {
    case 'loading':
      return 'Checking PTB simulation before wallet signing.';
    case 'ready':
      return 'Simulation completed. Review the intent before signing.';
    case 'blocked':
      return preview.error.message;
    case 'TODO_VERIFY_BLOCKED':
      return preview.error.message;
    case 'error':
      return preview.error.message;
  }
}

export function createPredictTxPreviewRows(
  preview: PredictPtbSimulationPreview,
): PredictTxPreviewSummaryRow[] {
  const intent = preview.intent;

  return [
    { label: 'Action', value: intent.action },
    { label: 'Simulation status', value: formatPreviewStatus(preview.status) },
    { label: 'Sender', value: intent.sender },
    { label: 'Network', value: intent.configIds.network },
    { label: 'Predict object', value: intent.configIds.predictObjectId },
    { label: 'Package', value: intent.configIds.packageId },
    { label: 'Quote asset', value: intent.configIds.quoteAssetType },
    { label: 'PLP type', value: intent.configIds.plpType },
    ...optionalRow('Manager', intent.managerId),
    ...optionalRow('Oracle', intent.oracleId),
    ...intent.assets.map(formatAssetRow),
    ...createSimulationRows(preview),
  ];
}

export function getPredictTxPreviewRecoveryCopy(
  preview: PredictPtbSimulationPreview,
): string | undefined {
  return 'error' in preview ? preview.error.recovery : undefined;
}

export function getPredictTxPreviewWarnings(preview: PredictPtbSimulationPreview): string[] {
  const simulationWarnings = 'simulation' in preview ? preview.simulation.warnings : [];

  return [...preview.intent.warnings, ...simulationWarnings];
}

function getPredictTxPreviewTitle(intent: PredictSimulationIntent): string {
  return `${intent.action.replaceAll('_', ' ')} preview`;
}

function optionalRow(label: string, value?: string): PredictTxPreviewSummaryRow[] {
  return value === undefined ? [] : [{ label, value }];
}

function formatAssetRow(asset: PredictSimulationAsset): PredictTxPreviewSummaryRow {
  return {
    label: formatAssetRole(asset.role),
    value: asset.amount === undefined ? asset.type : `${asset.amount.toString()} ${asset.type}`,
  };
}

function formatAssetRole(role: PredictSimulationAsset['role']): string {
  switch (role) {
    case 'expected-cost':
      return 'Expected cost';
    case 'expected-payout':
      return 'Expected payout';
    case 'plp':
      return 'PLP amount';
    case 'quantity':
      return 'Quantity';
    case 'quote':
      return 'Quote amount';
  }
}

function createSimulationRows(preview: PredictPtbSimulationPreview): PredictTxPreviewSummaryRow[] {
  if (!('simulation' in preview)) {
    return [];
  }

  const returnValueCount = preview.simulation.commandResults.reduce(
    (total, command) => total + command.returnValueCount,
    0,
  );
  const mutatedReferenceCount = preview.simulation.commandResults.reduce(
    (total, command) => total + command.mutatedReferenceCount,
    0,
  );

  return [
    ...optionalRow('Simulation digest', preview.simulation.digest),
    { label: 'Effects status', value: preview.simulation.effectsStatus },
    { label: 'Balance changes', value: preview.simulation.balanceChangeCount.toString() },
    { label: 'Command results', value: preview.simulation.commandResultCount.toString() },
    { label: 'Return values', value: returnValueCount.toString() },
    { label: 'Mutated references', value: mutatedReferenceCount.toString() },
    { label: 'Events', value: preview.simulation.eventCount.toString() },
    { label: 'Changed object types', value: preview.simulation.changedObjectTypeCount.toString() },
  ];
}

function formatPreviewStatus(status: PredictPtbSimulationPreview['status']) {
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
