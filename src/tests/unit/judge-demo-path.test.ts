import { describe, expect, it } from 'vitest';
import {
  selectJudgeDemoPathViewModel,
  type SelectJudgeDemoPathOptions,
} from '@/features/demo/judge-demo-path';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { BestDemoMarketCandidate } from '@/features/markets/lib/best-market-finder';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import type { ProofModeViewModel } from '@/features/proof/proof-selectors';
import type { ProofSubmittedRecord } from '@/features/proof/proof-session-context';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';

const walletAddress =
  '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const managerId = '0x8582108550fb82fb859b3ca3371869147fee58f1d0cce11f99d2704bf42f905a' as ObjectId;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('selectJudgeDemoPathViewModel', () => {
  it('blocks disconnected wallets at the environment step', () => {
    const viewModel = selectJudgeDemoPathViewModel(baseOptions());

    expect(viewModel.verdict).toBe('Blocked');
    expect(viewModel.currentStep.id).toBe('environment');
    expect(viewModel.steps[0]?.status).toBe('blocked');
    expect(viewModel.evidence.find((item) => item.label === 'Digest')?.value).toBe(
      'No submitted digest',
    );
  });

  it('blocks ready wallets when no best market is available', () => {
    const viewModel = selectJudgeDemoPathViewModel(
      baseOptions({
        wallet: walletFixture({ isConnected: true }),
      }),
    );

    expect(viewModel.verdict).toBe('Blocked');
    expect(viewModel.currentStep.id).toBe('best-market');
    expect(viewModel.currentStep.status).toBe('blocked');
  });

  it('blocks live execution when manager DUSDC is missing', () => {
    const viewModel = selectJudgeDemoPathViewModel(
      baseOptions({
        bestMarket: bestMarketFixture(),
        manager: managerFixture({ isReady: true }),
        managerSummary: managerSummaryFixture({ tradingBalanceQuote: 0n }),
        wallet: walletFixture({ isConnected: true }),
      }),
    );

    expect(viewModel.verdict).toBe('Blocked');
    expect(viewModel.currentStep.id).toBe('manager-funding');
    expect(viewModel.currentStep.description).toContain('DUSDC funding is missing');
  });

  it('marks a funded path ready before submission without fabricating proof', () => {
    const viewModel = selectJudgeDemoPathViewModel(
      baseOptions({
        bestMarket: bestMarketFixture(),
        manager: managerFixture({ isReady: true }),
        managerSummary: managerSummaryFixture({ tradingBalanceQuote: 1_000_000n }),
        wallet: walletFixture({ isConnected: true }),
      }),
    );

    expect(viewModel.verdict).toBe('Ready for live demo');
    expect(viewModel.currentStep.id).toBe('strategy-preview');
    expect(viewModel.evidence.find((item) => item.label === 'Digest')?.value).toBe(
      'No submitted digest',
    );
  });

  it('uses pending index for a real digest without Proof Mode reconciliation', () => {
    const viewModel = selectJudgeDemoPathViewModel(
      baseOptions({
        bestMarket: bestMarketFixture(),
        latestSubmittedProof: submittedProofFixture(),
        manager: managerFixture({ isReady: true }),
        managerSummary: managerSummaryFixture({ tradingBalanceQuote: 1_000_000n }),
        proof: proofFixture({ digest, status: 'Pending Index' }),
        wallet: walletFixture({ isConnected: true }),
      }),
    );

    expect(viewModel.verdict).toBe('Pending index');
    expect(viewModel.currentStep.id).toBe('reconciliation');
    expect(viewModel.currentStep.status).toBe('ready');
  });

  it('requires Proof Mode verified reconciliation before showing verified in app', () => {
    const viewModel = selectJudgeDemoPathViewModel(
      baseOptions({
        bestMarket: bestMarketFixture(),
        latestSubmittedProof: submittedProofFixture(),
        manager: managerFixture({ isReady: true }),
        managerSummary: managerSummaryFixture({ tradingBalanceQuote: 1_000_000n }),
        proof: proofFixture({ digest, status: 'Verified' }),
        wallet: walletFixture({ isConnected: true }),
      }),
    );

    expect(viewModel.verdict).toBe('Verified in app');
    expect(viewModel.steps.every((step) => step.status === 'complete')).toBe(true);
  });
});

function baseOptions(
  overrides: Partial<SelectJudgeDemoPathOptions> = {},
): SelectJudgeDemoPathOptions {
  return {
    bestMarket: null,
    bestMarketLoading: false,
    historyLoading: false,
    latestPreparedReview: null,
    latestSubmittedProof: null,
    manager: managerFixture({ isReady: false }),
    managerSummary: undefined,
    managerSummaryLoading: false,
    proof: proofFixture(),
    wallet: walletFixture({ isConnected: false }),
    ...overrides,
  };
}

function walletFixture({ isConnected }: { isConnected: boolean }): WalletStatusModel {
  return {
    accountAddress: isConnected ? walletAddress : null,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected,
    isConnecting: false,
    isDisconnected: !isConnected,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: isConnected ? '0x24d9...d19b' : null,
    status: isConnected ? 'connected' : 'disconnected',
    statusLabel: isConnected ? 'Connected' : 'Disconnected',
    supportedIntentsCount: 0,
    walletName: isConnected ? 'Slush' : null,
  };
}

function managerFixture({ isReady }: { isReady: boolean }): UsePredictManagerResult {
  return {
    authoritativeObject: null,
    error: null,
    isAmbiguous: false,
    isConfirming: false,
    isLoading: false,
    isReady,
    manager: null,
    managerId: isReady ? managerId : null,
    matchingManagers: [],
    owner: isReady ? walletAddress : null,
    requiresCreateManager: !isReady,
    status: isReady ? 'READY' : 'NO_MANAGER',
    warnings: [],
  };
}

function managerSummaryFixture({
  tradingBalanceQuote,
}: {
  tradingBalanceQuote: bigint;
}): ManagerSummaryPortfolioModel {
  return {
    balanceSummary: {
      tradingBalanceQuote,
    },
  } as ManagerSummaryPortfolioModel;
}

function bestMarketFixture(): BestDemoMarketCandidate {
  return {
    auditHref: `/oracle-status?oracleId=${oracleId}&source=best-market-finder`,
    marketQualityScore: 80,
    oracle: {
      underlyingAsset: 'BTC',
    },
    oracleId,
    strategyHref: `/markets/${oracleId}?source=best-market-finder`,
  } as BestDemoMarketCandidate;
}

function submittedProofFixture(): ProofSubmittedRecord {
  return {
    action: 'MINT',
    affectedObjects: [{ id: managerId, kind: 'manager' }],
    completedDigest: digest,
    confirmedStatus: 'success',
    managerId,
    oracleId,
    recordedAtMs: 1_781_635_255_000,
    refreshWarning: null,
    sender: walletAddress,
  };
}

function proofFixture({
  digest: proofDigest = null,
  status = 'Ready',
}: {
  digest?: TransactionDigest | null;
  status?: ProofModeViewModel['status'];
} = {}): ProofModeViewModel {
  return {
    digest: proofDigest,
    executionRows: [],
    explanation: status,
    matchedHistoryDigest: status === 'Verified' ? proofDigest : null,
    readinessRows: [],
    reconciliationRows: [],
    sourceLabels: [],
    status,
    title: status,
    tone: status === 'Verified' ? 'success' : 'empty',
  };
}
