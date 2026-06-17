import type { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { appSuiClient } from '@/lib/sui-client';
import { createAppError, normalizeAppError, type PredictPilotError } from '@/lib/errors';
import type { AffectedObjectHint, PredictTransactionExecutionRequest } from '@/types/tx';
import type { MoveType, ObjectId, PredictNetwork, QuoteAmount } from '@/types/predict';
import { predictProtocolTypes } from '../targets';

export type PredictPtbPreviewStatus =
  | 'TODO_VERIFY_BLOCKED'
  | 'blocked'
  | 'error'
  | 'loading'
  | 'ready';

export interface PredictSimulationConfig {
  network?: PredictNetwork;
  packageId?: ObjectId;
  plpType?: MoveType;
  predictObjectId?: ObjectId;
  quoteAssetType?: MoveType;
}

export interface PredictSimulationTransport {
  simulateTransaction: (input: PredictSimulationTransportInput) => Promise<unknown>;
}

export interface PredictSimulationTransportInput {
  checksEnabled?: boolean;
  include: typeof PREDICT_SIMULATION_INCLUDE;
  transaction: Transaction;
}

export interface PreviewPredictTransactionSimulationOptions {
  builderPreview?: unknown;
  checksEnabled?: boolean;
  config?: PredictSimulationConfig;
  request?: PredictTransactionExecutionRequest | null;
  transport?: PredictSimulationTransport | null;
}

export interface PredictSimulationIntent {
  action: PredictTransactionExecutionRequest['action'];
  affectedObjects: AffectedObjectHint[];
  assets: PredictSimulationAsset[];
  configIds: PredictSimulationConfigIds;
  description?: string;
  expectedCostQuote?: QuoteAmount;
  expectedPayoutQuote?: QuoteAmount;
  managerId?: ObjectId;
  oracleId?: ObjectId;
  sender: PredictTransactionExecutionRequest['sender'];
  warnings: string[];
}

export interface PredictSimulationAsset {
  amount?: bigint;
  role: 'expected-cost' | 'expected-payout' | 'plp' | 'quantity' | 'quote';
  type: MoveType;
}

export interface PredictCommandResultSummary {
  commandIndex: number;
  mutatedReferenceCount: number;
  returnValueCount: number;
}

export interface PredictSimulationConfigIds {
  network: PredictNetwork;
  packageId: ObjectId;
  plpType: MoveType;
  predictObjectId: ObjectId;
  quoteAssetType: MoveType;
}

export interface PredictSimulationSummary {
  balanceChangeCount: number;
  changedObjectTypeCount: number;
  commandResultCount: number;
  commandResults: PredictCommandResultSummary[];
  digest?: string;
  effectsStatus: 'failure' | 'success' | 'unknown';
  eventCount: number;
  rawKind: 'FailedTransaction' | 'Transaction' | 'unknown';
  warnings: string[];
}

export type PredictPtbSimulationPreview =
  | {
      intent: PredictSimulationIntent;
      status: 'loading';
    }
  | {
      error: PredictPilotError;
      intent: PredictSimulationIntent;
      status: 'TODO_VERIFY_BLOCKED';
    }
  | {
      error: PredictPilotError;
      intent: PredictSimulationIntent;
      simulation: PredictSimulationSummary;
      status: 'blocked';
    }
  | {
      error: PredictPilotError;
      intent: PredictSimulationIntent;
      status: 'error';
    }
  | {
      intent: PredictSimulationIntent;
      simulation: PredictSimulationSummary;
      status: 'ready';
    };

export const PREDICT_SIMULATION_INCLUDE = {
  balanceChanges: true,
  commandResults: true,
  effects: true,
  events: true,
  objectTypes: true,
  transaction: true,
} as const;

export async function previewPredictTransactionSimulation({
  builderPreview,
  checksEnabled = true,
  config = defaultSimulationConfig(),
  request,
  transport = appSuiClient,
}: PreviewPredictTransactionSimulationOptions): Promise<PredictPtbSimulationPreview> {
  const configValidation = validateSimulationConfig(config);
  const intent = createSimulationIntent({
    builderPreview,
    config: configValidation.ok ? configValidation.config : fallbackSimulationConfig(),
    request,
  });

  if (!configValidation.ok) {
    return {
      error: configValidation.error,
      intent,
      status: 'TODO_VERIFY_BLOCKED',
    };
  }

  if (request === null || request === undefined || !isTransactionLike(request.transaction)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: request?.action,
          field: 'transaction',
          service: 'previewPredictTransactionSimulation',
        },
        message: 'A valid PTB is required before simulation preview.',
        recovery: 'Rebuild the transaction preview before running simulation.',
      }),
      intent,
      simulation: {
        balanceChangeCount: 0,
        changedObjectTypeCount: 0,
        commandResultCount: 0,
        commandResults: [],
        effectsStatus: 'unknown',
        eventCount: 0,
        rawKind: 'unknown',
        warnings: ['Simulation did not run because the PTB was missing or invalid.'],
      },
      status: 'blocked',
    };
  }

  if (transport === null || transport === undefined) {
    return {
      error: createAppError('TODO_VERIFY_PATH_USED', {
        context: {
          action: request.action,
          service: 'previewPredictTransactionSimulation',
        },
        message: 'No PTB simulation transport is configured.',
        recovery: 'Verify the current Sui client transport before enabling simulation preview.',
      }),
      intent,
      status: 'TODO_VERIFY_BLOCKED',
    };
  }

  try {
    const rawResult = await transport.simulateTransaction({
      checksEnabled,
      include: PREDICT_SIMULATION_INCLUDE,
      transaction: request.transaction,
    });
    const simulation = summarizeSimulationResult(rawResult);

    if (simulation.effectsStatus === 'failure' || simulation.rawKind === 'FailedTransaction') {
      return {
        error: createAppError('SIMULATION_FAILED', {
          context: {
            action: request.action,
            digest: simulation.digest,
            service: 'previewPredictTransactionSimulation',
          },
        }),
        intent,
        simulation,
        status: 'blocked',
      };
    }

    return {
      intent,
      simulation,
      status: 'ready',
    };
  } catch (error) {
    return {
      error: normalizeAppError(error, {
        context: {
          action: request.action,
          service: 'previewPredictTransactionSimulation',
        },
      }),
      intent,
      status: 'error',
    };
  }
}

export function createLoadingPtbPreview({
  builderPreview,
  config = defaultSimulationConfig(),
  request,
}: Pick<
  PreviewPredictTransactionSimulationOptions,
  'builderPreview' | 'config' | 'request'
>): PredictPtbSimulationPreview {
  const configValidation = validateSimulationConfig(config);

  return {
    intent: createSimulationIntent({
      builderPreview,
      config: configValidation.ok ? configValidation.config : fallbackSimulationConfig(),
      request,
    }),
    status: 'loading',
  };
}

function createSimulationIntent({
  builderPreview,
  config,
  request,
}: {
  builderPreview: unknown;
  config: PredictSimulationConfigIds;
  request?: PredictTransactionExecutionRequest | null;
}): PredictSimulationIntent {
  const preview = isRecord(builderPreview) ? builderPreview : {};
  const affectedObjects = request?.affectedObjects ?? getPreviewAffectedObjects(preview);

  return {
    action: request?.action ?? getPreviewAction(preview),
    affectedObjects,
    assets: getPreviewAssets(preview, config),
    configIds: config,
    ...(request?.description === undefined ? {} : { description: request.description }),
    ...getExpectedAmounts(preview),
    ...getObjectContext(preview, affectedObjects),
    sender: request?.sender ?? getPreviewSender(preview),
    warnings: getPreviewWarnings(preview),
  };
}

function summarizeSimulationResult(result: unknown): PredictSimulationSummary {
  if (!isRecord(result)) {
    return {
      balanceChangeCount: 0,
      changedObjectTypeCount: 0,
      commandResultCount: 0,
      commandResults: [],
      effectsStatus: 'unknown',
      eventCount: 0,
      rawKind: 'unknown',
      warnings: [
        'Simulation returned an unknown response shape.',
        'Simulation effects status is unknown.',
        'Simulation command results were not returned.',
        'Simulation returned no balance changes.',
      ],
    };
  }

  const rawKind =
    result.$kind === 'Transaction' || result.$kind === 'FailedTransaction'
      ? result.$kind
      : 'unknown';
  const payload =
    rawKind === 'Transaction' && isRecord(result.Transaction)
      ? result.Transaction
      : rawKind === 'FailedTransaction' && isRecord(result.FailedTransaction)
        ? result.FailedTransaction
        : result;
  const effects = isRecord(payload.effects) ? payload.effects : undefined;
  const statusPayload = isRecord(effects?.status) ? effects.status : payload.status;
  const effectsStatus = getEffectsStatus(statusPayload);
  const rawCommandResults = result.commandResults;
  const commandResultsPresent = Array.isArray(rawCommandResults);
  const commandResults: unknown[] = commandResultsPresent ? rawCommandResults : [];
  const balanceChanges = Array.isArray(payload.balanceChanges) ? payload.balanceChanges : [];
  const events = Array.isArray(payload.events) ? payload.events : [];
  const objectTypes = isRecord(payload.objectTypes) ? payload.objectTypes : {};
  const commandResultSummaries = commandResults.map((commandResult, commandIndex) =>
    summarizeCommandResult(commandResult, commandIndex),
  );
  const warnings = createSimulationWarnings({
    balanceChangeCount: balanceChanges.length,
    commandResultsPresent,
    effectsStatus,
  });

  return {
    balanceChangeCount: balanceChanges.length,
    changedObjectTypeCount: Object.keys(objectTypes).length,
    commandResultCount: commandResults.length,
    commandResults: commandResultSummaries,
    ...(typeof payload.digest === 'string' ? { digest: payload.digest } : {}),
    effectsStatus,
    eventCount: events.length,
    rawKind,
    warnings,
  };
}

function validateSimulationConfig(config: PredictSimulationConfig):
  | {
      config: PredictSimulationConfigIds;
      ok: true;
    }
  | {
      error: PredictPilotError;
      ok: false;
    } {
  if (config.network !== 'testnet') {
    return missingSimulationConfig('network');
  }

  if (!hasValidObjectId(config.packageId)) {
    return missingSimulationConfig('packageId');
  }

  if (!hasValidObjectId(config.predictObjectId)) {
    return missingSimulationConfig('predictObjectId');
  }

  if (!isMoveType(config.quoteAssetType)) {
    return missingSimulationConfig('quoteAssetType');
  }

  if (!isMoveType(config.plpType)) {
    return missingSimulationConfig('plpType');
  }

  return {
    config: config as PredictSimulationConfigIds,
    ok: true,
  };
}

function missingSimulationConfig(field: keyof PredictSimulationConfig) {
  return {
    error: createAppError('TODO_VERIFY_PATH_USED', {
      context: {
        field,
        service: 'previewPredictTransactionSimulation',
      },
      message: 'PTB simulation configuration is incomplete.',
      recovery: 'Verify the current DeepBook Predict and Sui Testnet config before simulation.',
    }),
    ok: false as const,
  };
}

function defaultSimulationConfig(): PredictSimulationConfig {
  return {
    network: predictDeploymentConfig.network,
    packageId: predictDeploymentConfig.packageId,
    plpType: predictProtocolTypes.plpType,
    predictObjectId: predictDeploymentConfig.predictObjectId,
    quoteAssetType: predictProtocolTypes.quoteAssetType,
  };
}

function fallbackSimulationConfig(): PredictSimulationConfigIds {
  return {
    network: 'testnet',
    packageId: '0x0',
    plpType: '0x0::todo_verify::PLP',
    predictObjectId: '0x0',
    quoteAssetType: '0x0::todo_verify::DUSDC',
  };
}

function getPreviewAction(
  preview: Record<string, unknown>,
): PredictTransactionExecutionRequest['action'] {
  return typeof preview.action === 'string'
    ? (preview.action as PredictTransactionExecutionRequest['action'])
    : 'CREATE_MANAGER';
}

function getPreviewAffectedObjects(preview: Record<string, unknown>): AffectedObjectHint[] {
  return Array.isArray(preview.affectedObjects)
    ? preview.affectedObjects.filter(isAffectedObjectHint)
    : [];
}

function getPreviewAssets(
  preview: Record<string, unknown>,
  config: PredictSimulationConfigIds,
): PredictSimulationAsset[] {
  const assets: PredictSimulationAsset[] = [];
  const expected = getExpectedAmounts(preview);
  const amountQuote = getBigint(preview.amountQuote);
  const quantityQuote = getBigint(preview.quantityQuote);
  const plpAmountAtomic = getBigint(preview.plpAmountAtomic);

  if (amountQuote !== undefined) {
    assets.push({ amount: amountQuote, role: 'quote', type: config.quoteAssetType });
  }

  if (quantityQuote !== undefined) {
    assets.push({ amount: quantityQuote, role: 'quantity', type: config.quoteAssetType });
  }

  if (plpAmountAtomic !== undefined) {
    assets.push({ amount: plpAmountAtomic, role: 'plp', type: config.plpType });
  }

  if (expected.expectedCostQuote !== undefined) {
    assets.push({
      amount: expected.expectedCostQuote,
      role: 'expected-cost',
      type: config.quoteAssetType,
    });
  }

  if (expected.expectedPayoutQuote !== undefined) {
    assets.push({
      amount: expected.expectedPayoutQuote,
      role: 'expected-payout',
      type: config.quoteAssetType,
    });
  }

  return assets;
}

function getExpectedAmounts(preview: Record<string, unknown>) {
  return {
    ...(getBigint(preview.estimatedCostQuote) === undefined
      ? {}
      : { expectedCostQuote: getBigint(preview.estimatedCostQuote) }),
    ...(getBigint(preview.estimatedPayoutQuote) === undefined
      ? {}
      : { expectedPayoutQuote: getBigint(preview.estimatedPayoutQuote) }),
  };
}

function getObjectContext(
  preview: Record<string, unknown>,
  affectedObjects: AffectedObjectHint[],
): Pick<PredictSimulationIntent, 'managerId' | 'oracleId'> {
  const managerId =
    getObjectId(preview.managerId) ??
    affectedObjects.find((object) => object.kind === 'manager')?.id;
  const oracleId =
    getObjectId(preview.oracleId) ?? affectedObjects.find((object) => object.kind === 'oracle')?.id;

  return {
    ...(managerId === undefined ? {} : { managerId }),
    ...(oracleId === undefined ? {} : { oracleId }),
  };
}

function getPreviewWarnings(preview: Record<string, unknown>): string[] {
  if (!Array.isArray(preview.warnings)) {
    return [];
  }

  return preview.warnings
    .map((warning) => {
      if (typeof warning === 'string') {
        return warning;
      }

      if (isRecord(warning) && typeof warning.message === 'string') {
        return warning.message;
      }

      if (isRecord(warning) && typeof warning.code === 'string') {
        return warning.code;
      }

      return undefined;
    })
    .filter((warning): warning is string => warning !== undefined);
}

function getPreviewSender(preview: Record<string, unknown>) {
  return typeof preview.sender === 'string'
    ? (preview.sender as PredictTransactionExecutionRequest['sender'])
    : '0x0';
}

function getEffectsStatus(value: unknown): PredictSimulationSummary['effectsStatus'] {
  if (isRecord(value) && value.status === 'success') {
    return 'success';
  }

  if (isRecord(value) && value.status === 'failure') {
    return 'failure';
  }

  if (value === 'success' || value === 'failure') {
    return value;
  }

  return 'unknown';
}

function summarizeCommandResult(value: unknown, commandIndex: number): PredictCommandResultSummary {
  const commandResult = isRecord(value) ? value : {};

  return {
    commandIndex,
    mutatedReferenceCount: Array.isArray(commandResult.mutatedReferences)
      ? commandResult.mutatedReferences.length
      : 0,
    returnValueCount: Array.isArray(commandResult.returnValues)
      ? commandResult.returnValues.length
      : 0,
  };
}

function createSimulationWarnings({
  balanceChangeCount,
  commandResultsPresent,
  effectsStatus,
}: {
  balanceChangeCount: number;
  commandResultsPresent: boolean;
  effectsStatus: PredictSimulationSummary['effectsStatus'];
}) {
  const warnings: string[] = [];

  if (effectsStatus === 'unknown') {
    warnings.push('Simulation effects status is unknown.');
  }

  if (!commandResultsPresent) {
    warnings.push('Simulation command results were not returned.');
  }

  if (balanceChangeCount === 0) {
    warnings.push('Simulation returned no balance changes.');
  }

  return warnings;
}

function isAffectedObjectHint(value: unknown): value is AffectedObjectHint {
  return isRecord(value) && typeof value.kind === 'string';
}

function getObjectId(value: unknown): ObjectId | undefined {
  return typeof value === 'string' && ObjectIdSchema.safeParse(value).success
    ? (value as ObjectId)
    : undefined;
}

function getBigint(value: unknown): bigint | undefined {
  return typeof value === 'bigint' ? value : undefined;
}

function hasValidObjectId(objectId: ObjectId | undefined): objectId is ObjectId {
  return typeof objectId === 'string' && ObjectIdSchema.safeParse(objectId).success;
}

function isMoveType(value: unknown): value is MoveType {
  return typeof value === 'string' && /^0x[a-fA-F0-9]+::[^:]+::[^:]+$/.test(value);
}

function isTransactionLike(transaction: unknown): transaction is Transaction {
  return isRecord(transaction) && typeof transaction.getData === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
