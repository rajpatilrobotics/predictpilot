import { Transaction } from '@mysten/sui/transactions';
import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes } from '@/integrations/deepbook-predict/targets';
import {
  DEFAULT_PRE_SIGN_PREVIEW_TTL_MS,
  validateNoConcurrentExecution,
  validatePreSignSecurity,
} from '@/lib/security';
import type { PredictPtbSimulationPreview } from '@/integrations/deepbook-predict/tx/simulate';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { PredictTransactionExecutionRequest } from '@/types/tx';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as ObjectId;

describe('security guards', () => {
  it('allows a fresh ready simulation preview to request signature', () => {
    const result = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 1_000,
      phase: 'ready',
      previewPreparedAtMs: 1_000,
      request: createExecutionRequest(),
      service: 'security.test',
      simulationPreview: createReadySimulationPreview(),
    });

    expect(result).toEqual({ ok: true });
  });

  it('blocks missing requests, non-ready simulation, and non-ready phases', () => {
    const missingRequest = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 1_000,
      phase: 'ready',
      previewPreparedAtMs: 1_000,
      request: null,
      service: 'security.test',
      simulationPreview: createReadySimulationPreview(),
    });
    const loadingSimulation = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 1_000,
      phase: 'ready',
      previewPreparedAtMs: 1_000,
      request: createExecutionRequest(),
      service: 'security.test',
      simulationPreview: { intent: createReadySimulationPreview().intent, status: 'loading' },
    });
    const idlePhase = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 1_000,
      phase: 'idle',
      previewPreparedAtMs: 1_000,
      request: createExecutionRequest(),
      service: 'security.test',
      simulationPreview: createReadySimulationPreview(),
    });

    expect(missingRequest.ok).toBe(false);
    expect(loadingSimulation.ok).toBe(false);
    expect(idlePhase.ok).toBe(false);
    if (!missingRequest.ok && !loadingSimulation.ok && !idlePhase.ok) {
      expect(missingRequest.error.code).toBe('INVALID_INPUT');
      expect(loadingSimulation.error.message).toBe('The transaction simulation is not ready.');
      expect(idlePhase.error.message).toBe('The transaction is not ready for wallet signature.');
    }
  });

  it('blocks stale previews using the configured TTL', () => {
    const result = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 1_000 + DEFAULT_PRE_SIGN_PREVIEW_TTL_MS + 1,
      phase: 'ready',
      previewPreparedAtMs: 1_000,
      request: createExecutionRequest(),
      service: 'security.test',
      simulationPreview: createReadySimulationPreview(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.message).toBe('The transaction preview is stale.');
      expect(result.error.context).toMatchObject({
        action: 'MINT',
        previewTtlMs: DEFAULT_PRE_SIGN_PREVIEW_TTL_MS,
        service: 'security.test',
      });
    }
  });

  it('blocks concurrent review and signing phases', () => {
    expect(
      validateNoConcurrentExecution({
        action: 'MINT',
        phase: 'ready',
        service: 'security.test',
      }),
    ).toEqual({ ok: true });

    for (const phase of ['building', 'simulating', 'signing'] as const) {
      const result = validateNoConcurrentExecution({
        action: 'MINT',
        phase,
        service: 'security.test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(
          'Another transaction review or wallet request is already in progress.',
        );
        expect(result.error.context).toMatchObject({
          action: 'MINT',
          phase,
          service: 'security.test',
        });
      }
    }
  });

  it('keeps guard errors UI-safe and sanitized', () => {
    const result = validatePreSignSecurity({
      action: 'MINT',
      nowMs: 5_000,
      phase: 'ready',
      previewPreparedAtMs: 1_000,
      previewTtlMs: 1,
      request: createExecutionRequest(),
      service: 'security.test',
      simulationPreview: createReadySimulationPreview(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.context).not.toHaveProperty('transaction');
      expect(JSON.stringify(result.error)).not.toContain('PRIVATE KEY');
      expect(JSON.stringify(result.error)).not.toContain('seed phrase');
    }
  });
});

function createExecutionRequest(): PredictTransactionExecutionRequest {
  return {
    action: 'MINT',
    affectedObjects: [
      {
        id: managerId,
        kind: 'manager',
        label: 'PredictManager',
      },
    ],
    description: 'Security guard test request',
    sender,
    transaction: new Transaction(),
  };
}

function createReadySimulationPreview(): Extract<
  PredictPtbSimulationPreview,
  { status: 'ready' }
> {
  return {
    intent: {
      action: 'MINT',
      affectedObjects: [],
      assets: [],
      configIds: {
        network: predictDeploymentConfig.network,
        packageId: predictDeploymentConfig.packageId,
        plpType: predictProtocolTypes.plpType,
        predictObjectId: predictDeploymentConfig.predictObjectId,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
      },
      sender,
      warnings: [],
    },
    simulation: {
      balanceChangeCount: 1,
      changedObjectTypeCount: 1,
      commandResultCount: 1,
      commandResults: [
        {
          commandIndex: 0,
          mutatedReferenceCount: 0,
          returnValueCount: 1,
        },
      ],
      digest: 'sim-digest',
      effectsStatus: 'success',
      eventCount: 1,
      rawKind: 'Transaction',
      warnings: [],
    },
    status: 'ready',
  };
}
