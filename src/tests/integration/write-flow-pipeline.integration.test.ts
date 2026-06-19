import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { buildMintBinaryTx } from '@/integrations/deepbook-predict/tx/mint-binary';
import { buildMintRangeTx } from '@/integrations/deepbook-predict/tx/mint-range';
import { buildSupplyVaultTx } from '@/integrations/deepbook-predict/tx/supply-vault';
import {
  previewPredictTransactionSimulation,
  type PredictSimulationTransport,
} from '@/integrations/deepbook-predict/tx/simulate';
import { runPostTransactionRefresh } from '@/lib/post-tx-refresh';
import { executePredictTransaction, type PredictTransactionTransport } from '@/lib/tx-executor';
import type { TransactionDigest } from '@/types/predict';
import {
  createVaultFixture,
  expectPtbOk,
  ptbManagerId,
  ptbMarketKey,
  ptbQuantityQuote,
  ptbRangeKey,
  ptbSender,
  ptbVaultAmountQuote,
} from '../ptb/ptb-test-helpers';

const digest = '9QFneskU8tW7UxQf7tE5qFRfcN4FadtC2Z3HAZkgeETd' as TransactionDigest;

function createSuccessfulSimulationTransport(): PredictSimulationTransport {
  return {
    simulateTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        balanceChanges: [{ amount: '1' }],
        digest: 'simulation-digest',
        effects: { status: { status: 'success' } },
        events: [{ type: 'predict::Minted' }],
        objectTypes: {
          objectA: '0x2::coin::Coin',
        },
      },
      commandResults: [
        { mutatedReferences: [], returnValues: [{ bcs: new Uint8Array([1]) }] },
        { mutatedReferences: [{ objectId: 'objectA' }], returnValues: [] },
      ],
    }),
  };
}

function createSuccessfulExecutionTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest,
        effects: {
          status: { success: true },
          transactionDigest: digest,
        },
      },
    }),
    waitForTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest,
        effects: {
          status: { success: true },
          transactionDigest: digest,
        },
      },
    }),
  };
}

function createMockQueryClient(onInvalidate?: (queryKey: QueryKey) => void) {
  const invalidateQueries = vi.fn((filters?: { queryKey?: QueryKey }) => {
    if (filters?.queryKey !== undefined) {
      onInvalidate?.(filters.queryKey);
    }
  });

  return {
    invalidateQueries,
    queryClient: {
      invalidateQueries: invalidateQueries as unknown as Pick<
        QueryClient,
        'invalidateQueries'
      >['invalidateQueries'],
    },
  };
}

describe('Predict write integration pipeline', () => {
  it('runs a binary PTB through simulation, execution, and ordered refresh', async () => {
    const build = expectPtbOk(
      buildMintBinaryTx({
        managerId: ptbManagerId,
        marketKey: ptbMarketKey,
        quantityQuote: ptbQuantityQuote,
        sender: ptbSender,
      }),
    );
    const simulationTransport = createSuccessfulSimulationTransport();
    const executionTransport = createSuccessfulExecutionTransport();
    const refreshCalls: string[] = [];
    const { invalidateQueries, queryClient } = createMockQueryClient((queryKey) => {
      refreshCalls.push(queryKey.join('.'));
    });

    const simulation = await previewPredictTransactionSimulation({
      builderPreview: build.preview,
      request: build.executionRequest,
      transport: simulationTransport,
    });
    const execution = await executePredictTransaction(build.executionRequest, executionTransport);

    if (execution.status !== 'success') {
      throw new Error('expected mocked execution to succeed');
    }

    const refreshWarning = await runPostTransactionRefresh({
      action: build.preview.action,
      affectedObjects: execution.affectedObjects,
      authoritativeRefreshes: [
        {
          label: 'manager-authority',
          refresh: () => {
            refreshCalls.push('authoritative:manager-authority');
          },
        },
      ],
      digest: execution.digest,
      queryClient,
      queryKeys: build.preview.postTransactionRefreshKeys,
      service: 'integration.binaryMint',
    });

    expect(simulation).toMatchObject({
      intent: {
        action: 'MINT',
        managerId: ptbManagerId,
        oracleId: ptbMarketKey.oracleId,
      },
      simulation: {
        balanceChangeCount: 1,
        commandResultCount: 2,
        effectsStatus: 'success',
      },
      status: 'ready',
    });
    expect(execution).toMatchObject({
      action: 'MINT',
      confirmedStatus: 'success',
      digest,
      status: 'success',
    });
    expect(refreshWarning).toBeNull();
    expect(refreshCalls[0]).toBe('authoritative:manager-authority');
    expect(invalidateQueries).toHaveBeenCalledTimes(
      build.preview.postTransactionRefreshKeys.length,
    );
  });

  it('keeps range and vault builder previews compatible with the shared simulation adapter', async () => {
    const rangeBuild = expectPtbOk(
      buildMintRangeTx({
        managerId: ptbManagerId,
        quantityQuote: ptbQuantityQuote,
        rangeKey: ptbRangeKey,
        sender: ptbSender,
      }),
    );
    const vaultBuild = expectPtbOk(
      buildSupplyVaultTx({
        amountQuote: ptbVaultAmountQuote,
        sender: ptbSender,
        vault: createVaultFixture(),
      }),
    );
    const simulationTransport = createSuccessfulSimulationTransport();

    const rangeSimulation = await previewPredictTransactionSimulation({
      builderPreview: rangeBuild.preview,
      request: rangeBuild.executionRequest,
      transport: simulationTransport,
    });
    const vaultSimulation = await previewPredictTransactionSimulation({
      builderPreview: vaultBuild.preview,
      request: vaultBuild.executionRequest,
      transport: simulationTransport,
    });

    expect(rangeSimulation).toMatchObject({
      intent: {
        action: 'MINT_RANGE',
        managerId: ptbManagerId,
        oracleId: ptbRangeKey.oracleId,
      },
      status: 'ready',
    });
    expect(vaultSimulation.status).toBe('ready');

    if (vaultSimulation.status !== 'ready') {
      throw new Error('expected vault simulation to be ready');
    }

    expect(vaultSimulation.intent.action).toBe('SUPPLY');
    expect(vaultSimulation.intent.assets).toContainEqual(
      expect.objectContaining({
        amount: ptbVaultAmountQuote,
        role: 'quote',
      }),
    );
  });

  it('returns a sanitized refresh warning while continuing best-effort invalidation', async () => {
    const build = expectPtbOk(
      buildSupplyVaultTx({
        amountQuote: ptbVaultAmountQuote,
        sender: ptbSender,
        vault: createVaultFixture(),
      }),
    );
    const refreshCalls: string[] = [];
    const { queryClient } = createMockQueryClient((queryKey) => {
      refreshCalls.push(queryKey.join('.'));
      if (refreshCalls.length === 1) {
        throw new Error('cache failure should stay sanitized');
      }
    });

    const warning = await runPostTransactionRefresh({
      action: build.preview.action,
      affectedObjects: build.preview.affectedObjects,
      digest,
      queryClient,
      queryKeys: build.preview.postTransactionRefreshKeys,
      service: 'integration.vaultSupply',
    });

    expect(refreshCalls).toHaveLength(build.preview.postTransactionRefreshKeys.length);
    expect(warning).toMatchObject({
      code: 'POST_TX_REFRESH_FAILED',
      context: {
        action: 'SUPPLY',
        failedRefreshes: 1,
        service: 'integration.vaultSupply',
      },
    });
    expect(JSON.stringify(warning?.context)).not.toContain('cache failure');
  });
});
