import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { PredictTransactionAction, PredictTransactionExecutionRequest } from '@/types/tx';

export const DEFAULT_PRE_SIGN_PREVIEW_TTL_MS = 60_000;

export type SecurityGuardPhase =
  | 'building'
  | 'failure'
  | 'idle'
  | 'ready'
  | 'signing'
  | 'simulating'
  | 'success';

export type SecurityGuardResult =
  | {
      ok: true;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

export interface ValidateNoConcurrentExecutionOptions {
  action: PredictTransactionAction;
  phase: SecurityGuardPhase;
  service: string;
}

export interface ValidatePreSignSecurityOptions {
  action: PredictTransactionAction;
  phase: SecurityGuardPhase;
  previewPreparedAtMs: number | null;
  previewTtlMs?: number;
  request: PredictTransactionExecutionRequest | null;
  service: string;
  simulationPreview: PredictPtbSimulationPreview | null;
  nowMs?: number;
}

const LOCKED_PHASES = new Set<SecurityGuardPhase>(['building', 'signing', 'simulating']);

export function isExecutionPhaseLocked(phase: SecurityGuardPhase) {
  return LOCKED_PHASES.has(phase);
}

export function validateNoConcurrentExecution({
  action,
  phase,
  service,
}: ValidateNoConcurrentExecutionOptions): SecurityGuardResult {
  if (!isExecutionPhaseLocked(phase)) {
    return { ok: true };
  }

  return {
    error: createAppError('INVALID_INPUT', {
      context: {
        action,
        phase,
        service,
      },
      message: 'Another transaction review or wallet request is already in progress.',
      recovery: 'Wait for the current review or wallet request to finish before trying again.',
      title: 'Action already in progress',
    }),
    ok: false,
  };
}

export function validatePreSignSecurity({
  action,
  nowMs = Date.now(),
  phase,
  previewPreparedAtMs,
  previewTtlMs = DEFAULT_PRE_SIGN_PREVIEW_TTL_MS,
  request,
  service,
  simulationPreview,
}: ValidatePreSignSecurityOptions): SecurityGuardResult {
  if (phase !== 'ready') {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          phase,
          service,
        },
        message: 'The transaction is not ready for wallet signature.',
        recovery: 'Run simulation and review the pre-sign modal before signing.',
        title: 'Signature blocked',
      }),
      ok: false,
    };
  }

  if (request === null) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'executionRequest',
          service,
        },
        message: 'The transaction request is missing.',
        recovery: 'Rebuild the transaction preview before requesting a wallet signature.',
        title: 'Signature blocked',
      }),
      ok: false,
    };
  }

  if (simulationPreview?.status !== 'ready') {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          simulationStatus: simulationPreview?.status ?? 'missing',
          service,
        },
        message: 'The transaction simulation is not ready.',
        recovery: 'Run simulation again and review the result before signing.',
        title: 'Simulation required',
      }),
      ok: false,
    };
  }

  if (previewPreparedAtMs === null) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          field: 'previewPreparedAtMs',
          service,
        },
        message: 'The preview timestamp is missing.',
        recovery: 'Rebuild the transaction preview before requesting a wallet signature.',
        title: 'Preview timestamp missing',
      }),
      ok: false,
    };
  }

  if (previewTtlMs <= 0 || nowMs - previewPreparedAtMs > previewTtlMs) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action,
          previewAgeMs: Math.max(0, nowMs - previewPreparedAtMs),
          previewTtlMs,
          service,
        },
        message: 'The transaction preview is stale.',
        recovery: 'Refresh state, rebuild the preview, and run simulation again before signing.',
        title: 'Preview expired',
      }),
      ok: false,
    };
  }

  return { ok: true };
}
