import { Transaction } from '@mysten/sui/transactions';
import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes } from '@/integrations/deepbook-predict/targets';
import {
  createLoadingPtbPreview,
  previewPredictTransactionSimulation,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import {
  isPredictTxPreviewReady,
  toPredictTxPreviewViewModel,
} from '@/features/tx/lib/tx-preview';
import { buildDepositToManagerTx } from '@/integrations/deepbook-predict/tx/deposit-manager';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as ObjectId;
const amountQuote = 1_500_000n as QuoteAmount;

function createDepositRequest() {
  const result = buildDepositToManagerTx({
    amountQuote,
    managerId,
    sender,
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result;
}

describe('PTB simulation preview adapter', () => {
  it('returns ready state for successful simulation and decodes intent fields', async () => {
    const txBuild = createDepositRequest();
    const transport = {
      simulateTransaction: vi.fn().mockResolvedValue({
        $kind: 'Transaction',
        Transaction: {
          balanceChanges: [{ amount: '1' }],
          digest: 'sim-digest',
          effects: { status: { status: 'success' } },
          events: [{ type: 'supplied' }],
          objectTypes: {
            [predictDeploymentConfig.predictObjectId]: `${predictDeploymentConfig.packageId}::predict::Predict`,
          },
        },
        commandResults: [
          { returnValues: [{ bcs: new Uint8Array([1]) }], mutatedReferences: [] },
          {
            returnValues: [],
            mutatedReferences: [{ bcs: new Uint8Array([2]) }, { bcs: new Uint8Array([3]) }],
          },
        ],
      }),
    } satisfies PredictSimulationTransport;

    const preview = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      request: txBuild.executionRequest,
      transport,
    });

    expect(preview.status).toBe('ready');
    expect(transport.simulateTransaction).toHaveBeenCalledWith({
      checksEnabled: true,
      include: {
        balanceChanges: true,
        commandResults: true,
        effects: true,
        events: true,
        objectTypes: true,
        transaction: true,
      },
      transaction: txBuild.transaction,
    });

    if (preview.status !== 'ready') {
      throw new Error('expected ready preview');
    }

    expect(preview.intent).toMatchObject({
      action: 'DEPOSIT_QUOTE',
      assets: [
        {
          amount: amountQuote,
          role: 'quote',
          type: predictProtocolTypes.quoteAssetType,
        },
      ],
      configIds: {
        network: 'testnet',
        packageId: predictDeploymentConfig.packageId,
        plpType: predictProtocolTypes.plpType,
        predictObjectId: predictDeploymentConfig.predictObjectId,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
      },
      managerId,
      sender,
    });
    expect(preview.simulation).toEqual({
      balanceChangeCount: 1,
      changedObjectTypeCount: 1,
      commandResultCount: 2,
      commandResults: [
        {
          commandIndex: 0,
          mutatedReferenceCount: 0,
          returnValueCount: 1,
        },
        {
          commandIndex: 1,
          mutatedReferenceCount: 2,
          returnValueCount: 0,
        },
      ],
      digest: 'sim-digest',
      effectsStatus: 'success',
      eventCount: 1,
      rawKind: 'Transaction',
      warnings: [],
    });

    const viewModel = toPredictTxPreviewViewModel(preview);
    expect(isPredictTxPreviewReady(preview)).toBe(true);
    expect(viewModel.canRequestSignature).toBe(true);
    expect(viewModel.rows).toEqual(
      expect.arrayContaining([
        { label: 'Action', value: 'DEPOSIT_QUOTE' },
        { label: 'Simulation status', value: 'Ready' },
        { label: 'Simulation digest', value: 'sim-digest' },
        { label: 'Effects status', value: 'success' },
        { label: 'Balance changes', value: '1' },
        { label: 'Command results', value: '2' },
        { label: 'Return values', value: '1' },
        { label: 'Mutated references', value: '2' },
        { label: 'Events', value: '1' },
        { label: 'Changed object types', value: '1' },
        { label: 'Predict object', value: predictDeploymentConfig.predictObjectId },
        {
          label: 'Quote amount',
          value: `${amountQuote.toString()} ${predictProtocolTypes.quoteAssetType}`,
        },
      ]),
    );
  });

  it('returns blocked state for failed simulation', async () => {
    const txBuild = createDepositRequest();
    const transport = {
      simulateTransaction: vi.fn().mockResolvedValue({
        $kind: 'FailedTransaction',
        FailedTransaction: {
          digest: 'failed-digest',
          effects: { status: { error: 'MoveAbort', status: 'failure' } },
        },
        commandResults: [],
      }),
    } satisfies PredictSimulationTransport;

    const preview = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      request: txBuild.executionRequest,
      transport,
    });

    expect(preview).toMatchObject({
      error: {
        code: 'SIMULATION_FAILED',
      },
      simulation: {
        changedObjectTypeCount: 0,
        commandResults: [],
        digest: 'failed-digest',
        effectsStatus: 'failure',
        eventCount: 0,
        rawKind: 'FailedTransaction',
      },
      status: 'blocked',
    });
    expect(isPredictTxPreviewReady(preview)).toBe(false);
  });

  it('returns error state for thrown simulation transport failures', async () => {
    const txBuild = createDepositRequest();
    const transport = {
      simulateTransaction: vi.fn().mockRejectedValue(new Error('grpc unavailable')),
    } satisfies PredictSimulationTransport;

    const preview = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      request: txBuild.executionRequest,
      transport,
    });

    expect(preview).toMatchObject({
      error: {
        code: 'UNKNOWN_ERROR',
      },
      status: 'error',
    });
    expect(toPredictTxPreviewViewModel(preview)).toMatchObject({
      canRequestSignature: false,
      recoveryCopy: 'Refresh the page and try again. If it repeats, keep the debug ID for support.',
      status: 'error',
    });
  });

  it('blocks invalid or missing PTBs before calling transport', async () => {
    const transport = {
      simulateTransaction: vi.fn(),
    } satisfies PredictSimulationTransport;
    const invalidRequest = {
      action: 'SUPPLY',
      sender,
      transaction: undefined,
    };

    const preview = await previewPredictTransactionSimulation({
      request: invalidRequest as unknown as Parameters<
        typeof previewPredictTransactionSimulation
      >[0]['request'],
      transport,
    });

    expect(preview).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        context: {
          field: 'transaction',
        },
      },
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
    });
    expect(transport.simulateTransaction).not.toHaveBeenCalled();
  });

  it('returns TODO_VERIFY_BLOCKED when transport or config is missing', async () => {
    const txBuild = createDepositRequest();
    const missingTransport = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      request: txBuild.executionRequest,
      transport: null,
    });
    const missingConfig = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      config: {
        network: 'testnet',
        plpType: predictProtocolTypes.plpType,
        predictObjectId: predictDeploymentConfig.predictObjectId,
        quoteAssetType: predictProtocolTypes.quoteAssetType,
      },
      request: txBuild.executionRequest,
      transport: {
        simulateTransaction: vi.fn(),
      },
    });

    expect(missingTransport).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
      },
      status: 'TODO_VERIFY_BLOCKED',
    });
    expect(missingConfig).toMatchObject({
      error: {
        code: 'TODO_VERIFY_PATH_USED',
        context: {
          field: 'packageId',
        },
      },
      status: 'TODO_VERIFY_BLOCKED',
    });
  });

  it('creates loading preview and formats expected amount intent fields', () => {
    const tx = new Transaction();
    const loading = createLoadingPtbPreview({
      builderPreview: {
        action: 'MINT',
        affectedObjects: [{ kind: 'oracle', id: predictDeploymentConfig.predictObjectId }],
        estimatedCostQuote: 25n,
        oracleId: predictDeploymentConfig.predictObjectId,
        sender,
        warnings: [{ message: 'Refresh oracle before signing' }],
      },
      request: {
        action: 'MINT',
        sender,
        transaction: tx,
      },
    });

    expect(loading).toMatchObject({
      intent: {
        action: 'MINT',
        expectedCostQuote: 25n,
        oracleId: predictDeploymentConfig.predictObjectId,
        warnings: ['Refresh oracle before signing'],
      },
      status: 'loading',
    });
    expect(toPredictTxPreviewViewModel(loading)).toMatchObject({
      canRequestSignature: false,
      status: 'loading',
      statusCopy: 'Checking PTB simulation before wallet signing.',
    });
  });

  it('adds warnings for unknown status, missing command results, and no balance changes', async () => {
    const txBuild = createDepositRequest();
    const transport = {
      simulateTransaction: vi.fn().mockResolvedValue({
        $kind: 'Transaction',
        Transaction: {
          balanceChanges: [],
          digest: 'unknown-status-digest',
          effects: { status: { status: 'pending' } },
        },
      }),
    } satisfies PredictSimulationTransport;

    const preview = await previewPredictTransactionSimulation({
      builderPreview: txBuild.preview,
      request: txBuild.executionRequest,
      transport,
    });

    expect(preview.status).toBe('ready');

    if (preview.status !== 'ready') {
      throw new Error('expected ready preview');
    }

    expect(preview.simulation).toMatchObject({
      balanceChangeCount: 0,
      commandResultCount: 0,
      effectsStatus: 'unknown',
      warnings: [
        'Simulation effects status is unknown.',
        'Simulation command results were not returned.',
        'Simulation returned no balance changes.',
      ],
    });
    expect(toPredictTxPreviewViewModel(preview).warnings).toEqual([
      'Simulation effects status is unknown.',
      'Simulation command results were not returned.',
      'Simulation returned no balance changes.',
    ]);
  });
});
