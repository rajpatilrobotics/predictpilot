import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  buildDraftStrategyReceipt,
  buildExecutionStrategyReceipt,
  buildProofStrategyReceipt,
} from '@/features/proof/strategy-receipt';
import { predictProtocolTypes } from '@/integrations/deepbook-predict/targets';
import type {
  PredictPtbSimulationPreview,
  PredictSimulationIntent,
  PredictSimulationSummary,
} from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import type { SuiAddress, TransactionDigest } from '@/types/predict';
import { tradeTestManagerId, tradeTestNowMs, tradeTestOracleId } from './trade-test-helpers';

const sender = '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('PP-066 strategy receipt model', () => {
  it('keeps draft selected strategy local with no digest or explorer proof', () => {
    const receipt = buildDraftStrategyReceipt({
      network: 'testnet',
      payoffSnapshot: {
        action: 'MINT',
        direction: 'UP',
        expiryMs: BigInt(tradeTestNowMs + 3_600_000),
        kind: 'binary',
        managerId: tradeTestManagerId,
        oracleId: tradeTestOracleId,
        quantityQuote: 1_000_000n,
        strike1e9: 50_000_000_000_000n,
        underlyingAsset: 'BTC',
      },
      sender,
    });

    expect(receipt.state).toBe('draft');
    expect(receipt.digest).toBeNull();
    expect(receipt.verdict).toBe('Draft strategy');
    expect(receipt.evidenceRows).toContainEqual(
      expect.objectContaining({ label: 'Proof status', value: 'No live proof yet' }),
    );
    expect(receipt.identityRows).toContainEqual(
      expect.objectContaining({ label: 'Direction / strike', value: 'UP @ 50,000.00' }),
    );
  });

  it('marks simulation-ready execution receipts without claiming submitted proof', () => {
    const receipt = buildExecutionStrategyReceipt({
      preview: createReadyPreview(),
      risk: {
        action: 'MINT',
        direction: 'UP',
        expiryMs: BigInt(tradeTestNowMs + 3_600_000),
        managerId: tradeTestManagerId,
        oracleId: tradeTestOracleId,
        payoffKind: 'binary',
        quantityQuote: 1_000_000n,
        strike1e9: 50_000_000_000_000n,
        underlyingAsset: 'BTC',
      },
    });

    expect(receipt.state).toBe('simulation_ready');
    expect(receipt.digest).toBeNull();
    expect(receipt.verdict).toBe('Simulation ready');
    expect(receipt.evidenceRows).toContainEqual(
      expect.objectContaining({ label: 'Wallet submission', value: 'Ready for wallet signature' }),
    );
  });

  it('includes digest evidence for submitted receipts while keeping reconciliation pending', () => {
    const receipt = buildExecutionStrategyReceipt({
      completedDigest: digest,
      preview: createReadyPreview(),
    });

    expect(receipt.state).toBe('submitted');
    expect(receipt.digest).toBe(digest);
    expect(receipt.verdict).toBe('Submitted to Sui Testnet');
    expect(receipt.reconciliationRows).toContainEqual(
      expect.objectContaining({ label: 'History refresh', value: 'Pending index' }),
    );
  });

  it('requires Proof Mode verified reconciliation before marking a receipt verified', () => {
    const pendingReceipt = buildProofStrategyReceipt({
      latestPreparedReview: null,
      latestSubmittedProof: {
        action: 'MINT',
        affectedObjects: [],
        completedDigest: digest,
        confirmedStatus: 'success',
        managerId: tradeTestManagerId,
        oracleId: tradeTestOracleId,
        recordedAtMs: tradeTestNowMs,
        refreshWarning: null,
        sender,
      },
      viewModel: createProofViewModel('Pending Index'),
    });
    const verifiedReceipt = buildProofStrategyReceipt({
      latestPreparedReview: null,
      latestSubmittedProof: pendingReceiptInput(),
      viewModel: createProofViewModel('Verified'),
    });

    expect(pendingReceipt.state).toBe('pending_index');
    expect(verifiedReceipt.state).toBe('verified');
    expect(verifiedReceipt.verdict).toBe('Verified');
  });

  it('does not claim proof for failed receipts unless a digest exists', () => {
    const receipt = buildExecutionStrategyReceipt({
      executionError: createAppError('TRANSACTION_REJECTED'),
      preview: createReadyPreview(),
    });

    expect(receipt.state).toBe('failed');
    expect(receipt.digest).toBeNull();
    expect(receipt.verdict).toBe('Failed');
    expect(receipt.description).toContain('Do not treat this receipt as proof');
  });

  it('renders range identity fields with the protocol range interval', () => {
    const receipt = buildDraftStrategyReceipt({
      payoffSnapshot: {
        action: 'MINT_RANGE',
        expiryMs: BigInt(tradeTestNowMs + 3_600_000),
        higherStrike1e9: 51_000_000_000_000n,
        kind: 'range',
        lowerStrike1e9: 50_000_000_000_000n,
        oracleId: tradeTestOracleId,
        quantityQuote: 1_000_000n,
        underlyingAsset: 'BTC',
      },
    });

    expect(receipt.identityRows).toContainEqual(
      expect.objectContaining({ label: 'Range', value: '50,000.00 to 51,000.00' }),
    );
  });
});

function createReadyPreview(): PredictPtbSimulationPreview {
  return {
    intent: createIntent(),
    simulation: createSimulationSummary(),
    status: 'ready',
  };
}

function createIntent(overrides: Partial<PredictSimulationIntent> = {}): PredictSimulationIntent {
  return {
    action: 'MINT',
    affectedObjects: [
      { id: predictDeploymentConfig.predictObjectId, kind: 'predict', label: 'Predict' },
      { id: tradeTestManagerId, kind: 'manager', label: 'PredictManager' },
      { id: tradeTestOracleId, kind: 'oracle', label: 'OracleSVI' },
    ],
    assets: [
      {
        amount: 1_000_000n,
        role: 'quantity',
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
    managerId: tradeTestManagerId,
    oracleId: tradeTestOracleId,
    sender,
    warnings: [],
    ...overrides,
  };
}

function createSimulationSummary(
  overrides: Partial<PredictSimulationSummary> = {},
): PredictSimulationSummary {
  return {
    balanceChangeCount: 1,
    changedObjectTypeCount: 1,
    commandResultCount: 1,
    commandResults: [
      {
        commandIndex: 0,
        mutatedReferenceCount: 1,
        returnValueCount: 0,
      },
    ],
    effectsStatus: 'success',
    eventCount: 1,
    rawKind: 'Transaction',
    warnings: [],
    ...overrides,
  };
}

function pendingReceiptInput() {
  return {
    action: 'MINT' as const,
    affectedObjects: [],
    completedDigest: digest,
    confirmedStatus: 'success' as const,
    managerId: tradeTestManagerId,
    oracleId: tradeTestOracleId,
    recordedAtMs: tradeTestNowMs,
    refreshWarning: null,
    sender,
  };
}

function createProofViewModel(status: 'Pending Index' | 'Verified') {
  return {
    digest,
    executionRows: [],
    explanation: status,
    indexedSourceValue:
      status === 'Verified' ? 'Predict server matched' : 'Awaiting matching history',
    matchedHistoryDigest: status === 'Verified' ? digest : null,
    readinessRows: [],
    reconciliationRows: [],
    sourceLabels: [
      { label: 'Wallet' as const, status: 'pass' as const },
      { label: 'Chain' as const, status: 'pass' as const },
      {
        label: 'Predict server' as const,
        status: status === 'Verified' ? ('pass' as const) : ('pending' as const),
      },
      { label: 'Local' as const, status: 'pass' as const },
    ],
    status,
    title: status,
    tone: status === 'Verified' ? ('success' as const) : ('warning' as const),
  };
}
