import { PredictAdapterError } from '@/integrations/deepbook-predict/api/mapping';
import { HttpClientError } from '@/lib/http';
import { sanitizeTelemetryMetadata, type LogMetadata } from './logger';

export type PredictPilotErrorCode =
  | 'EXTERNAL_API_SHAPE_CHANGED'
  | 'INSUFFICIENT_MANAGER_DUSDC'
  | 'INSUFFICIENT_WALLET_DUSDC'
  | 'INVALID_INPUT'
  | 'INVALID_RANGE'
  | 'MANAGER_NOT_FOUND'
  | 'ONCHAIN_OBJECT_NOT_FOUND'
  | 'ORACLE_NOT_TRADEABLE'
  | 'ORACLE_STALE'
  | 'POST_TX_REFRESH_FAILED'
  | 'PREDICT_SERVER_REQUEST_FAILED'
  | 'PREDICT_SERVER_UNAVAILABLE'
  | 'PREDICT_SERVER_UNHEALTHY'
  | 'PTB_BUILD_FAILED'
  | 'SIMULATION_FAILED'
  | 'TODO_VERIFY_PATH_USED'
  | 'TRANSACTION_FAILED'
  | 'TRANSACTION_REJECTED'
  | 'UNKNOWN_ERROR'
  | 'WALLET_RESPONSE_TIMEOUT'
  | 'WALLET_NOT_CONNECTED'
  | 'WRONG_NETWORK';

export type PredictPilotErrorKind =
  | 'external-api'
  | 'input'
  | 'network'
  | 'protocol'
  | 'refresh'
  | 'simulation'
  | 'todo-verify'
  | 'transaction'
  | 'transport'
  | 'unknown'
  | 'wallet';

export type PredictPilotErrorSeverity = 'critical' | 'error' | 'info' | 'warning';

export interface PredictPilotError {
  code: PredictPilotErrorCode;
  context?: LogMetadata;
  debugId: string;
  kind: PredictPilotErrorKind;
  message: string;
  recovery: string;
  retryable: boolean;
  severity: PredictPilotErrorSeverity;
  title: string;
}

export interface NormalizeAppErrorOptions {
  context?: LogMetadata;
}

export interface CreateAppErrorOptions {
  context?: LogMetadata;
  message?: string;
  recovery?: string;
  retryable?: boolean;
  title?: string;
}

interface ErrorDefinition {
  kind: PredictPilotErrorKind;
  message: string;
  recovery: string;
  retryable: boolean;
  severity: PredictPilotErrorSeverity;
  title: string;
}

let debugIdCounter = 0;

const ERROR_DEFINITIONS: Record<PredictPilotErrorCode, ErrorDefinition> = {
  EXTERNAL_API_SHAPE_CHANGED: {
    kind: 'external-api',
    message: 'PredictPilot received data in an unexpected shape.',
    recovery: 'Refresh the data. If it repeats, re-check the current Predict server contract.',
    retryable: true,
    severity: 'error',
    title: 'Predict data changed',
  },
  INSUFFICIENT_MANAGER_DUSDC: {
    kind: 'protocol',
    message: 'The selected PredictManager does not have enough DUSDC for this action.',
    recovery: 'Deposit DUSDC into the manager or lower the amount before continuing.',
    retryable: false,
    severity: 'warning',
    title: 'Manager balance too low',
  },
  INSUFFICIENT_WALLET_DUSDC: {
    kind: 'protocol',
    message: 'The connected wallet does not have enough DUSDC for this action.',
    recovery: 'Fund the Testnet wallet with DUSDC or lower the amount before continuing.',
    retryable: false,
    severity: 'warning',
    title: 'Wallet balance too low',
  },
  INVALID_INPUT: {
    kind: 'input',
    message: 'One or more inputs are invalid.',
    recovery: 'Review the highlighted inputs and try again.',
    retryable: false,
    severity: 'warning',
    title: 'Invalid input',
  },
  INVALID_RANGE: {
    kind: 'input',
    message: 'The selected range is invalid.',
    recovery: 'Choose a lower strike that is below the higher strike.',
    retryable: false,
    severity: 'warning',
    title: 'Invalid range',
  },
  MANAGER_NOT_FOUND: {
    kind: 'protocol',
    message: 'No usable PredictManager was found for this wallet.',
    recovery: 'Create a manager or select an existing manager before trading.',
    retryable: false,
    severity: 'warning',
    title: 'Manager required',
  },
  ONCHAIN_OBJECT_NOT_FOUND: {
    kind: 'protocol',
    message: 'A required Sui object could not be found.',
    recovery: 'Refresh the app and verify the current Testnet configuration.',
    retryable: true,
    severity: 'error',
    title: 'Object not found',
  },
  ORACLE_NOT_TRADEABLE: {
    kind: 'protocol',
    message: 'The selected oracle is not currently tradeable.',
    recovery: 'Pick an active oracle or wait for the market state to update.',
    retryable: true,
    severity: 'warning',
    title: 'Oracle not tradeable',
  },
  ORACLE_STALE: {
    kind: 'protocol',
    message: 'The selected oracle data is stale.',
    recovery: 'Refresh oracle state before previewing or signing a transaction.',
    retryable: true,
    severity: 'warning',
    title: 'Oracle data stale',
  },
  POST_TX_REFRESH_FAILED: {
    kind: 'refresh',
    message: 'The transaction may be confirmed, but the indexed view did not refresh cleanly.',
    recovery: 'Use the digest to verify onchain status, then refresh affected data.',
    retryable: true,
    severity: 'warning',
    title: 'Refresh incomplete',
  },
  PREDICT_SERVER_REQUEST_FAILED: {
    kind: 'transport',
    message: 'Predict server rejected the request.',
    recovery: 'Refresh the page. If it repeats, verify the endpoint and request parameters.',
    retryable: false,
    severity: 'error',
    title: 'Predict request failed',
  },
  PREDICT_SERVER_UNAVAILABLE: {
    kind: 'transport',
    message: 'Predict server is unavailable or timed out.',
    recovery: 'Retry the request. Cached data may be stale until the server responds.',
    retryable: true,
    severity: 'error',
    title: 'Predict server unavailable',
  },
  PREDICT_SERVER_UNHEALTHY: {
    kind: 'transport',
    message: 'Predict server reported an unhealthy indexing state.',
    recovery: 'Wait briefly, then refresh before using the data for decisions.',
    retryable: true,
    severity: 'warning',
    title: 'Predict server degraded',
  },
  PTB_BUILD_FAILED: {
    kind: 'transaction',
    message: 'PredictPilot could not build the transaction safely.',
    recovery: 'Refresh state and verify the selected manager, oracle, amount, and config.',
    retryable: false,
    severity: 'error',
    title: 'Transaction build failed',
  },
  SIMULATION_FAILED: {
    kind: 'simulation',
    message: 'The transaction simulation failed.',
    recovery: 'Review the preview, refresh onchain state, and try again.',
    retryable: true,
    severity: 'error',
    title: 'Simulation failed',
  },
  TODO_VERIFY_PATH_USED: {
    kind: 'todo-verify',
    message: 'This path depends on a protocol detail that is still marked TODO VERIFY.',
    recovery: 'Verify the current official DeepBook Predict source before enabling this flow.',
    retryable: false,
    severity: 'critical',
    title: 'Verification required',
  },
  TRANSACTION_FAILED: {
    kind: 'transaction',
    message: 'The onchain transaction failed.',
    recovery: 'Check the wallet result and digest, then refresh manager, oracle, and history data.',
    retryable: true,
    severity: 'error',
    title: 'Transaction failed',
  },
  TRANSACTION_REJECTED: {
    kind: 'wallet',
    message: 'The transaction was rejected in the wallet.',
    recovery: 'Review the preview and try again when you are ready to sign.',
    retryable: true,
    severity: 'info',
    title: 'Wallet rejected request',
  },
  WALLET_RESPONSE_TIMEOUT: {
    kind: 'wallet',
    message: 'PredictPilot did not receive the wallet result after the signature request.',
    recovery:
      'Check the wallet activity and wait for indexed state to refresh before trying again.',
    retryable: true,
    severity: 'warning',
    title: 'Wallet response timed out',
  },
  UNKNOWN_ERROR: {
    kind: 'unknown',
    message: 'PredictPilot hit an unexpected error.',
    recovery: 'Refresh the page and try again. If it repeats, keep the debug ID for support.',
    retryable: true,
    severity: 'error',
    title: 'Unexpected error',
  },
  WALLET_NOT_CONNECTED: {
    kind: 'wallet',
    message: 'No wallet is connected.',
    recovery: 'Connect a Sui wallet on Testnet before continuing.',
    retryable: false,
    severity: 'warning',
    title: 'Wallet required',
  },
  WRONG_NETWORK: {
    kind: 'network',
    message: 'PredictPilot currently supports DeepBook Predict on Sui Testnet only.',
    recovery: 'Switch your wallet to Sui Testnet, then refresh the current view.',
    retryable: false,
    severity: 'critical',
    title: 'Wrong network',
  },
};

export function normalizeAppError(
  error: unknown,
  { context }: NormalizeAppErrorOptions = {},
): PredictPilotError {
  if (isPredictPilotError(error)) {
    return context === undefined ? error : mergeErrorContext(error, context);
  }

  if (isWalletRejectionLike(error)) {
    return createAppError('TRANSACTION_REJECTED', { context });
  }

  if (error instanceof HttpClientError) {
    return normalizeHttpClientError(error, context);
  }

  if (error instanceof PredictAdapterError) {
    return createAppError('EXTERNAL_API_SHAPE_CHANGED', {
      context: {
        ...context,
        adapterError: error.message,
      },
    });
  }

  if (error instanceof Error) {
    return createAppError('UNKNOWN_ERROR', {
      context: {
        ...context,
        errorName: error.name,
      },
    });
  }

  return createAppError('UNKNOWN_ERROR', {
    context,
  });
}

export function createAppError(
  code: PredictPilotErrorCode,
  options: CreateAppErrorOptions = {},
): PredictPilotError {
  const definition = ERROR_DEFINITIONS[code];

  return {
    code,
    debugId: createDebugId(code),
    kind: definition.kind,
    message: options.message ?? definition.message,
    recovery: options.recovery ?? definition.recovery,
    retryable: options.retryable ?? definition.retryable,
    severity: definition.severity,
    title: options.title ?? definition.title,
    ...(options.context === undefined ? {} : { context: sanitizeContext(options.context) }),
  };
}

export function wrongNetworkError(actualNetwork?: string) {
  return createAppError('WRONG_NETWORK', {
    context: { actualNetwork, expectedNetwork: 'testnet' },
  });
}

export function walletNotConnectedError() {
  return createAppError('WALLET_NOT_CONNECTED');
}

export function staleOracleError(context?: LogMetadata) {
  return createAppError('ORACLE_STALE', { context });
}

export function oracleNotTradeableError(context?: LogMetadata) {
  return createAppError('ORACLE_NOT_TRADEABLE', { context });
}

export function invalidRangeError(context?: LogMetadata) {
  return createAppError('INVALID_RANGE', { context });
}

export function invalidInputError(context?: LogMetadata) {
  return createAppError('INVALID_INPUT', { context });
}

export function insufficientManagerDusdcError(context?: LogMetadata) {
  return createAppError('INSUFFICIENT_MANAGER_DUSDC', { context });
}

export function insufficientWalletDusdcError(context?: LogMetadata) {
  return createAppError('INSUFFICIENT_WALLET_DUSDC', { context });
}

export function managerNotFoundError(context?: LogMetadata) {
  return createAppError('MANAGER_NOT_FOUND', { context });
}

export function todoVerifyPathError(context?: LogMetadata) {
  return createAppError('TODO_VERIFY_PATH_USED', { context });
}

export function isPredictPilotError(error: unknown): error is PredictPilotError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as Partial<PredictPilotError>;
  return (
    typeof candidate.code === 'string' &&
    candidate.code in ERROR_DEFINITIONS &&
    typeof candidate.debugId === 'string' &&
    typeof candidate.message === 'string'
  );
}

function normalizeHttpClientError(error: HttpClientError, context?: LogMetadata) {
  const sharedContext = {
    ...context,
    status: error.status,
    url: error.url,
  };

  switch (error.kind) {
    case 'validation':
    case 'invalid-json':
      return createAppError('EXTERNAL_API_SHAPE_CHANGED', {
        context: sharedContext,
      });
    case 'network':
    case 'timeout':
      return createAppError('PREDICT_SERVER_UNAVAILABLE', {
        context: sharedContext,
      });
    case 'http-status':
      if (error.status !== undefined && error.status >= 500) {
        return createAppError('PREDICT_SERVER_UNAVAILABLE', {
          context: sharedContext,
        });
      }

      return createAppError('PREDICT_SERVER_REQUEST_FAILED', {
        context: sharedContext,
      });
  }
}

function isWalletRejectionLike(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(cancelled|canceled|declined|denied|rejected|user rejected|user rejected the request)/i.test(
    error.message,
  );
}

function mergeErrorContext(error: PredictPilotError, context: LogMetadata): PredictPilotError {
  return {
    ...error,
    context: sanitizeContext({
      ...error.context,
      ...context,
    }),
  };
}

function sanitizeContext(context: LogMetadata) {
  return sanitizeTelemetryMetadata(context) as LogMetadata;
}

function createDebugId(code: PredictPilotErrorCode) {
  debugIdCounter += 1;
  return `pp-${code.toLowerCase().replaceAll('_', '-')}-${debugIdCounter}`;
}
