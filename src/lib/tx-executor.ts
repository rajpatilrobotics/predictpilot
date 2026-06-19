import { createAppError, normalizeAppError, type PredictPilotError } from '@/lib/errors';
import type {
  PredictTransactionConfirmedStatus,
  PredictTransactionExecutionRequest,
  PredictTransactionExecutionResult,
} from '@/types/tx';
import type { TransactionDigest } from '@/types/predict';

const DEFAULT_TRANSACTION_INCLUDE = {
  effects: true,
  events: true,
  objectTypes: true,
} as const;

export interface PredictTransactionTransport {
  signAndExecuteTransaction: (
    input: PredictSignAndExecuteTransactionInput,
  ) => Promise<PredictWalletTransactionResult>;
  waitForTransaction?: (
    input: PredictWaitForTransactionInput,
  ) => Promise<PredictWalletTransactionResult>;
}

export interface PredictSignAndExecuteTransactionInput {
  include: typeof DEFAULT_TRANSACTION_INCLUDE;
  transaction: PredictTransactionExecutionRequest['transaction'];
}

export interface PredictWaitForTransactionInput {
  digest: TransactionDigest;
  include: typeof DEFAULT_TRANSACTION_INCLUDE;
}

export type PredictWalletTransactionResult = unknown;

interface NormalizedWalletResult {
  digest?: TransactionDigest;
  errorMessage?: string;
  status: PredictTransactionConfirmedStatus;
}

export async function executePredictTransaction(
  request: PredictTransactionExecutionRequest,
  transport: PredictTransactionTransport,
): Promise<PredictTransactionExecutionResult> {
  const affectedObjects = request.affectedObjects ?? [];
  const sharedResult = {
    action: request.action,
    affectedObjects,
    ...(request.description === undefined ? {} : { description: request.description }),
    sender: request.sender,
  };

  try {
    const walletResult = normalizeWalletTransactionResult(
      await transport.signAndExecuteTransaction({
        include: DEFAULT_TRANSACTION_INCLUDE,
        transaction: request.transaction,
      }),
    );

    if (walletResult.status === 'failure') {
      return {
        ...sharedResult,
        confirmedStatus: 'failure',
        ...(walletResult.digest === undefined ? {} : { digest: walletResult.digest }),
        error: transactionFailedError(request, walletResult),
        status: 'failure',
      };
    }

    if (walletResult.digest === undefined) {
      return {
        ...sharedResult,
        confirmedStatus: 'unknown',
        error: transactionFailedError(request, {
          errorMessage: 'Wallet returned a successful transaction result without a digest.',
          status: 'unknown',
        }),
        status: 'failure',
      };
    }

    const confirmation = await waitForConfirmationIfAvailable({
      digest: walletResult.digest,
      request,
      transport,
    });

    if (confirmation.status === 'failure') {
      return {
        ...sharedResult,
        confirmedStatus: 'failure',
        digest: walletResult.digest,
        error: transactionFailedError(request, confirmation),
        status: 'failure',
      };
    }

    return {
      ...sharedResult,
      confirmedStatus: confirmation.status,
      digest: walletResult.digest,
      ...(confirmation.warning === undefined ? {} : { postSubmitWarning: confirmation.warning }),
      status: 'success',
    };
  } catch (error) {
    const normalized = normalizeAppError(error, {
      context: {
        action: request.action,
        sender: request.sender,
      },
    });

    return {
      ...sharedResult,
      confirmedStatus: 'unknown',
      error: normalized,
      status: 'failure',
    };
  }
}

function normalizeWalletTransactionResult(
  result: PredictWalletTransactionResult,
): NormalizedWalletResult {
  if (!isRecord(result)) {
    return { status: 'unknown' };
  }

  if (result.$kind === 'Transaction' && isRecord(result.Transaction)) {
    return normalizeTransactionPayload(result.Transaction, 'success');
  }

  if (result.$kind === 'FailedTransaction' && isRecord(result.FailedTransaction)) {
    return normalizeTransactionPayload(result.FailedTransaction, 'failure');
  }

  return normalizeTransactionPayload(result, inferStatusFromPayload(result));
}

function normalizeTransactionPayload(
  payload: Record<string, unknown>,
  fallbackStatus: PredictTransactionConfirmedStatus,
): NormalizedWalletResult {
  const effects = isRecord(payload.effects) ? payload.effects : undefined;
  const status =
    extractExecutionStatus(payload.status) ??
    extractExecutionStatus(effects?.status) ??
    fallbackStatus;
  const digest =
    firstString(payload.digest, effects?.transactionDigest, payload.transactionDigest) ?? undefined;
  const errorMessage =
    firstString(payload.error, payload.errorMessage) ??
    extractExecutionError(payload.status) ??
    extractExecutionError(effects?.status);

  return {
    ...(digest === undefined ? {} : { digest }),
    ...(errorMessage === undefined ? {} : { errorMessage }),
    status,
  };
}

async function waitForConfirmationIfAvailable({
  digest,
  request,
  transport,
}: {
  digest: TransactionDigest;
  request: PredictTransactionExecutionRequest;
  transport: PredictTransactionTransport;
}): Promise<NormalizedWalletResult & { warning?: PredictPilotError }> {
  if (transport.waitForTransaction === undefined) {
    return {
      digest,
      status: 'success',
    };
  }

  try {
    const waitResult = normalizeWalletTransactionResult(
      await transport.waitForTransaction({
        digest,
        include: DEFAULT_TRANSACTION_INCLUDE,
      }),
    );

    return {
      ...waitResult,
      digest: waitResult.digest ?? digest,
    };
  } catch (error) {
    return {
      digest,
      status: 'success',
      warning: createAppError('POST_TX_REFRESH_FAILED', {
        context: {
          action: request.action,
          digest,
          waitError: error instanceof Error ? error.name : typeof error,
        },
      }),
    };
  }
}

function transactionFailedError(
  request: PredictTransactionExecutionRequest,
  result: NormalizedWalletResult,
) {
  return createAppError('TRANSACTION_FAILED', {
    context: {
      action: request.action,
      digest: result.digest,
      failureReason: result.errorMessage,
      sender: request.sender,
    },
    ...(result.errorMessage === undefined
      ? {}
      : { message: `The onchain transaction failed: ${result.errorMessage}` }),
  });
}

function inferStatusFromPayload(
  payload: Record<string, unknown>,
): PredictTransactionConfirmedStatus {
  return (
    extractExecutionStatus(payload.status) ?? extractExecutionStatus(payload.effects) ?? 'unknown'
  );
}

function extractExecutionStatus(value: unknown): PredictTransactionConfirmedStatus | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.success === true || value.status === 'success') {
    return 'success';
  }

  if (value.success === false || value.status === 'failure' || value.status === 'failed') {
    return 'failure';
  }

  return undefined;
}

function extractExecutionError(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const direct = firstString(value.error, value.message);

  if (direct !== undefined) {
    return direct;
  }

  if (isRecord(value.error) && typeof value.error.command === 'number') {
    return `Command ${value.error.command} failed`;
  }

  return undefined;
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
