import { describe, expect, it } from 'vitest';
import { selectProofModeViewModel } from '@/features/proof/proof-selectors';
import type {
  ProofPreparedReviewRecord,
  ProofSubmittedRecord,
} from '@/features/proof/proof-session-context';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { TransactionHistoryTimelineModel } from '@/features/history/lib/history-selectors';
import type { ProtocolHistoryRecord } from '@/types/history';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';

const walletAddress =
  '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const managerId = '0x8582108550fb82fb859b3ca3371869147fee58f1d0cce11f99d2704bf42f905a' as ObjectId;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('proof mode selectors', () => {
  it('blocks proof when wallet readiness is missing', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      wallet: walletFixture({ isConnected: false }),
    });

    expect(viewModel.status).toBe('Blocked');
    expect(viewModel.digest).toBeNull();
    expect(viewModel.readinessRows.find((row) => row.label === 'Wallet')?.status).toBe('blocked');
  });

  it('marks manager-ready sessions without digest as ready', () => {
    const viewModel = selectProofModeViewModel(baseOptions());

    expect(viewModel.status).toBe('Ready');
    expect(viewModel.digest).toBeNull();
    expect(viewModel.executionRows.find((row) => row.label === 'Digest')?.value).toMatch(
      /wallet submission/i,
    );
  });

  it('marks local simulation-ready review as ready but not submitted', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      latestPreparedReview: preparedReviewFixture(),
    });

    expect(viewModel.status).toBe('Ready but Not Submitted');
    expect(viewModel.digest).toBeNull();
    expect(viewModel.sourceLabels.find((label) => label.label === 'Local')?.status).toBe('pass');
  });

  it('accepts a submitted chain digest but keeps it pending until indexed history matches', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      latestSubmittedProof: submittedProofFixture(),
    });

    expect(viewModel.status).toBe('Pending Index');
    expect(viewModel.digest).toBe(digest);
    expect(viewModel.matchedHistoryDigest).toBeNull();
    expect(viewModel.sourceLabels.find((label) => label.label === 'Chain')?.status).toBe('pass');
  });

  it('verifies manager funding with chain digest and refreshed manager summary', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      latestSubmittedProof: {
        ...submittedProofFixture(),
        action: 'DEPOSIT_QUOTE',
        amountQuote: 1_000n,
        oracleId: null,
      },
      managerSummary: managerSummaryFixture(),
    });

    expect(viewModel.status).toBe('Verified');
    expect(viewModel.digest).toBe(digest);
    expect(viewModel.matchedHistoryDigest).toBeNull();
    expect(viewModel.indexedSourceValue).toBe('Manager summary refreshed');
    expect(
      viewModel.executionRows.find((row) => row.label === 'Manager refresh')?.value,
    ).toBe('Manager summary refreshed after digest');
    expect(
      viewModel.reconciliationRows.find((row) => row.label === 'History reconciliation')?.value,
    ).toBe('Manager summary refreshed after funding digest');
  });

  it('verifies proof when Predict server history contains the submitted digest', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      history: historyFixture([historyRecordFixture()]),
      latestSubmittedProof: submittedProofFixture(),
    });

    expect(viewModel.status).toBe('Verified');
    expect(viewModel.digest).toBe(digest);
    expect(viewModel.matchedHistoryDigest).toBe(digest);
    expect(
      viewModel.reconciliationRows.find((row) => row.label === 'History reconciliation')?.status,
    ).toBe('pass');
  });

  it('does not treat arbitrary local prepared text as digest proof', () => {
    const viewModel = selectProofModeViewModel({
      ...baseOptions(),
      latestPreparedReview: {
        ...preparedReviewFixture(),
        description: `Pretend digest ${digest}`,
      },
    });

    expect(viewModel.status).toBe('Ready but Not Submitted');
    expect(viewModel.digest).toBeNull();
    expect(viewModel.executionRows.find((row) => row.label === 'Digest')?.source).toBe('Local');
  });
});

function baseOptions() {
  return {
    history: historyFixture([]),
    historyError: null,
    historyLoading: false,
    latestPreparedReview: null,
    latestSubmittedProof: null,
    manager: managerFixture({ isReady: true }),
    managerSummary: undefined,
    managerSummaryError: null,
    managerSummaryLoading: false,
    positions: undefined,
    positionsError: null,
    positionsLoading: false,
    wallet: walletFixture({ isConnected: true }),
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

function preparedReviewFixture(): ProofPreparedReviewRecord {
  return {
    action: 'MINT',
    affectedObjects: [{ id: managerId, kind: 'manager', label: 'PredictManager' }],
    managerId,
    oracleId: null,
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

function managerSummaryFixture(): ManagerSummaryPortfolioModel {
  return {
    balanceSummary: {
      accountValueQuote: 1_000n,
      awaitingSettlementPositions: 0,
      balances: [],
      managerId,
      openExposureQuote: 0n,
      openPositions: 0,
      owner: walletAddress,
      realizedPnlQuote: 0n,
      redeemableValueQuote: 0n,
      totalManagerBalanceQuote: 1_000n,
      tradingBalanceQuote: 1_000n,
      unrealizedPnlQuote: 0n,
    },
    summary: {
      accountValueQuote: 1_000n,
      awaitingSettlementPositions: 0,
      balances: [],
      lastRefreshedAtMs: null,
      managerId,
      openExposureQuote: 0n,
      openPositions: 0,
      owner: walletAddress,
      realizedPnlQuote: 0n,
      redeemableValueQuote: 0n,
      tradingBalanceQuote: 1_000n,
      unrealizedPnlQuote: 0n,
    },
  };
}

function historyFixture(records: ProtocolHistoryRecord[]): TransactionHistoryTimelineModel {
  return {
    countsByKind: {
      BINARY_MINT: records.filter((record) => record.kind === 'BINARY_MINT').length,
      BINARY_REDEEM: 0,
      LP_SUPPLY: 0,
      LP_WITHDRAW: 0,
      ORACLE_TRADE: 0,
      RANGE_MINT: 0,
      RANGE_REDEEM: 0,
    },
    feeds: {
      lpSupplies: [],
      lpWithdrawals: [],
      positionMints: records.filter(isBinaryMintHistoryRecord),
      positionRedeems: [],
      rangeMints: [],
      rangeRedeems: [],
    },
    isEmpty: records.length === 0,
    latestTimestampMs: records[0]?.timestampMs ?? null,
    managerId,
    owner: walletAddress,
    records,
    totalCount: records.length,
  };
}

function historyRecordFixture(): ProtocolHistoryRecord {
  return {
    costQuote: 1_000_000_000n,
    digest,
    kind: 'BINARY_MINT',
    key: {
      direction: 'UP',
      expiryMs: 1_791_000_000_000n,
      oracleId: '0xca4663',
      strike1e9: 50_000_000_000_000n,
    },
    managerId,
    predictId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
    quantityQuote: 1_000_000_000n,
    quoteAssetType: '0x2::coin::COIN',
    timestampMs: 1_791_000_010_000n,
    trader: walletAddress,
  };
}

function isBinaryMintHistoryRecord(
  record: ProtocolHistoryRecord,
): record is Extract<ProtocolHistoryRecord, { kind: 'BINARY_MINT' }> {
  return record.kind === 'BINARY_MINT';
}
