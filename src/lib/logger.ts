export type LogLevel = 'error' | 'info' | 'warn';
export type LogMetadata = Record<string, unknown>;

export interface AppLogger {
  error(eventName: string, metadata?: LogMetadata): void;
  info(eventName: string, metadata?: LogMetadata): void;
  warn(eventName: string, metadata?: LogMetadata): void;
}

export interface AppLoggerOptions {
  consoleLike?: Pick<Console, 'error' | 'info' | 'warn'>;
  enabled?: boolean;
}

const REDACTED = '[redacted]';
const MAX_DEPTH = 4;
const MAX_ARRAY_LENGTH = 20;

const SENSITIVE_KEY_PATTERN =
  /(auth|authorization|bearer|cookie|credential|keystore|mnemonic|password|private|secret|seed|signature|signed|token|txbytes|walletbackup|wallet_backup)/i;
const SENSITIVE_VALUE_PATTERN =
  /(BEGIN [A-Z ]*PRIVATE KEY|\.env\.local|\.env\.test|mnemonic|playwright\/\.auth|private key|seed phrase|wallet backup)/i;

const isDevRuntime = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

export const appLogger = createAppLogger({
  enabled: isDevRuntime,
});

export function createAppLogger({
  consoleLike = console,
  enabled = false,
}: AppLoggerOptions = {}): AppLogger {
  function emit(level: LogLevel, eventName: string, metadata: LogMetadata = {}) {
    if (!enabled) {
      return;
    }

    const safePayload = {
      eventName,
      metadata: sanitizeTelemetryMetadata(metadata),
    };

    consoleLike[level]('[PredictPilot]', safePayload);
  }

  return {
    error(eventName, metadata) {
      emit('error', eventName, metadata);
    },
    info(eventName, metadata) {
      emit('info', eventName, metadata);
    },
    warn(eventName, metadata) {
      emit('warn', eventName, metadata);
    },
  };
}

export function sanitizeTelemetryMetadata(value: unknown): unknown {
  return sanitizeUnknown(value, 0);
}

function sanitizeUnknown(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return '[truncated]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      message: sanitizeString(value.message),
      name: value.name,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeUnknown(item, depth + 1));
  }

  if (typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>, depth);
  }

  if (typeof value === 'function') {
    return value.name === '' ? '[function]' : `[function ${value.name}]`;
  }

  if (typeof value === 'symbol') {
    return value.description === undefined ? '[symbol]' : `[symbol ${value.description}]`;
  }

  return '[unserializable]';
}

function sanitizeRecord(record: Record<string, unknown>, depth: number) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
      continue;
    }

    sanitized[key] = sanitizeUnknown(value, depth + 1);
  }

  return sanitized;
}

function sanitizeString(value: string) {
  if (SENSITIVE_VALUE_PATTERN.test(value)) {
    return REDACTED;
  }

  return value;
}

function isSensitiveKey(key: string) {
  return key.toLowerCase() === 'stack' || SENSITIVE_KEY_PATTERN.test(key);
}
