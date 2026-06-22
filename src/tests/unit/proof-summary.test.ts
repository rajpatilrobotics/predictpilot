import { describe, expect, it } from 'vitest';
import { buildProofSummary } from '@/features/proof/proof-summary';
import type {
  ProofPreparedReviewRecord,
  ProofSubmittedRecord,
} from '@/features/proof/proof-session-context';
import type { ProofModeViewModel } from '@/features/proof/proof-selectors';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';

const walletAddress =
  '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const managerId = '0x8582108550fb82fb859b3ca3371869147fee58f1d0cce11f99d2704bf42f905a' as ObjectId;
const oracleId = '0xca4663aa66775a' as ObjectId;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('proof summary formatter', () => {
  it('keeps no-proof summaries non-copyable and digest-free', () => {
    const summary = buildProofSummary({
      generatedAtMs: 0,
      latestPreparedReview: null,
      latestSubmittedProof: null,
      viewModel: viewModelFixture({ status: 'Ready' }),
    });

    expect(summary.canCopy).toBe(false);
    expect(summary.mode).toBe('NO_PROOF');
    expect(summary.text).toContain('Mode: NO PROOF');
    expect(summary.text).toContain('Digest [C]: none');
    expect(summary.text).toContain('No preview or executed Testnet action');
  });

  it('labels local previews as preview only without fake execution proof', () => {
    const summary = buildProofSummary({
      generatedAtMs: 0,
      latestPreparedReview: preparedReviewFixture(),
      latestSubmittedProof: null,
      viewModel: viewModelFixture({ status: 'Ready but Not Submitted' }),
    });

    expect(summary.canCopy).toBe(true);
    expect(summary.mode).toBe('LOCAL_PREVIEW_ONLY');
    expect(summary.text).toContain('Mode: LOCAL PREVIEW ONLY');
    expect(summary.text).toContain('Action [L]: Mint');
    expect(summary.text).toContain('Digest [C]: none');
    expect(summary.text).toContain('Preview/simulation only. No onchain execution proof.');
  });

  it('includes real digest and pending-index copy for submitted proofs', () => {
    const summary = buildProofSummary({
      generatedAtMs: 0,
      latestPreparedReview: preparedReviewFixture(),
      latestSubmittedProof: submittedProofFixture(),
      viewModel: viewModelFixture({ digest, status: 'Pending Index' }),
    });

    expect(summary.canCopy).toBe(true);
    expect(summary.mode).toBe('LIVE_TESTNET_PROOF');
    expect(summary.text).toContain('Verdict: Pending Index');
    expect(summary.text).toContain(`Digest [C]: ${digest}`);
    expect(summary.text).toContain('/txblock/');
    expect(summary.text).toContain('Indexed portfolio/history may still be catching up.');
  });

  it('marks verified summaries only when the proof view is verified', () => {
    const summary = buildProofSummary({
      generatedAtMs: 0,
      latestPreparedReview: preparedReviewFixture(),
      latestSubmittedProof: submittedProofFixture(),
      viewModel: viewModelFixture({
        digest,
        matchedHistoryDigest: digest,
        status: 'Verified',
      }),
    });

    expect(summary.text).toContain('Verdict: Verified');
    expect(summary.text).toContain(
      'Real Testnet transaction with visible Predict server reconciliation.',
    );
  });

  it('does not turn failed proof states into verified copy', () => {
    const summary = buildProofSummary({
      generatedAtMs: 0,
      latestPreparedReview: preparedReviewFixture(),
      latestSubmittedProof: submittedProofFixture(),
      viewModel: viewModelFixture({ digest, status: 'Failed' }),
    });

    expect(summary.mode).toBe('FAILED');
    expect(summary.text).toContain('Verdict: Failed');
    expect(summary.text).toContain('No verified live proof for this action.');
  });
});

function preparedReviewFixture(): ProofPreparedReviewRecord {
  return {
    action: 'MINT',
    affectedObjects: [{ id: managerId, kind: 'manager', label: 'PredictManager' }],
    managerId,
    oracleId,
    preparedAtMs: 1_791_000_000_000,
    quantityQuote: 1_000_000_000n,
    sender: walletAddress,
    simulationStatus: 'ready',
  };
}

function submittedProofFixture(): ProofSubmittedRecord {
  return {
    ...preparedReviewFixture(),
    completedDigest: digest,
    confirmedStatus: 'success',
    recordedAtMs: 1_791_000_010_000,
    refreshWarning: null,
  };
}

function viewModelFixture({
  digest: digestOverride = null,
  matchedHistoryDigest = null,
  status,
}: {
  digest?: TransactionDigest | null;
  matchedHistoryDigest?: TransactionDigest | null;
  status: ProofModeViewModel['status'];
}): ProofModeViewModel {
  return {
    digest: digestOverride,
    executionRows: [
      {
        label: 'Action',
        source: 'Local',
        status: 'pass',
        value: 'Mint',
      },
    ],
    explanation: 'Proof summary test fixture.',
    matchedHistoryDigest,
    readinessRows: [
      {
        label: 'Wallet',
        source: 'Wallet',
        status: 'pass',
        value: `Slush ${walletAddress}`,
      },
      {
        label: 'Network',
        source: 'Wallet',
        status: 'pass',
        value: 'testnet',
      },
      {
        label: 'PredictManager',
        source: 'Predict server',
        status: 'pass',
        value: managerId,
      },
    ],
    reconciliationRows: [
      {
        label: 'Chain confirmation',
        source: 'Chain',
        status: digestOverride === null ? 'pending' : 'pass',
        value: digestOverride === null ? 'No submitted digest' : 'success',
      },
      {
        label: 'Portfolio refresh',
        source: 'Predict server',
        status: 'pass',
        value: 'Manager summary loaded',
      },
      {
        label: 'History reconciliation',
        source: 'Predict server',
        status: matchedHistoryDigest === null ? 'pending' : 'pass',
        value:
          matchedHistoryDigest === null ? 'No matching history row yet' : 'BINARY_MINT indexed',
      },
    ],
    sourceLabels: [
      { label: 'Wallet', status: 'pass' },
      { label: 'Chain', status: digestOverride === null ? 'pending' : 'pass' },
      { label: 'Predict server', status: matchedHistoryDigest === null ? 'pending' : 'pass' },
      { label: 'Local', status: 'pass' },
    ],
    status,
    title: status,
    tone: status === 'Verified' ? 'success' : 'empty',
  };
}
