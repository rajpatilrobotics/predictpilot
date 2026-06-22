import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { JudgeDemoPathPage } from '@/features/demo/JudgeDemoPathPage';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import type {
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { ProofSessionContextValue } from '@/features/proof/proof-session-context';
import { useProofSession } from '@/features/proof/proof-session-context';
import { useWalletStatus, type WalletStatusModel } from '@/features/wallet/useWalletStatus';
import { useTransactionHistory } from '@/features/history/hooks/useTransactionHistory';
import type { OracleSummaryModel } from '@/types/oracle';
import type { TransactionDigest } from '@/types/predict';
import {
  createTradeManagerSummaryPortfolio,
  querySuccess,
  tradeTestManagerId,
  tradeTestNowMs,
  tradeTestOracleCapId,
  tradeTestOracleId,
  tradeTestOwner,
} from './trade-test-helpers';

vi.mock('@/features/wallet/useWalletStatus', () => ({
  useWalletStatus: vi.fn(),
}));

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: vi.fn(),
}));

vi.mock('@/features/markets/hooks/usePredictOracles', () => ({
  usePredictOracles: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: vi.fn(),
}));

vi.mock('@/features/history/hooks/useTransactionHistory', () => ({
  useTransactionHistory: vi.fn(),
}));

vi.mock('@/features/proof/proof-session-context', () => ({
  useProofSession: vi.fn(),
}));

const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('JudgeDemoPathPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDefaultMocks();
  });

  it('renders disconnected guidance without fake proof or signature CTA', () => {
    render(<JudgeDemoPathPage />);

    expect(screen.getByRole('heading', { name: 'Judge Demo Path' })).toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'Judge demo verdict' })).toHaveTextContent('Blocked');
    expect(screen.getByRole('heading', { name: 'Connect wallet and confirm Testnet' }));
    expect(
      screen.queryByRole('button', { name: /request wallet signature/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view transaction/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No submitted digest yet/i)).toBeInTheDocument();
  });

  it('links a live-ready path to best strategy, oracle audit, manager, proof, portfolio, and history', () => {
    vi.mocked(useWalletStatus).mockReturnValue(walletFixture({ isConnected: true }));
    vi.mocked(usePredictManager).mockReturnValue(managerFixture({ isReady: true }));
    vi.mocked(useManagerSummary).mockReturnValue(
      querySuccess(createTradeManagerSummaryPortfolio()),
    );
    vi.mocked(usePredictOracles).mockReturnValue(querySuccess([createOracleSummary()]));

    render(<JudgeDemoPathPage />);

    expect(screen.getByRole('status', { name: 'Judge demo verdict' })).toHaveTextContent(
      'Ready for live demo',
    );
    const strategyLinks = screen.getAllByRole('link', { name: 'Open strategy builder' });
    expect(strategyLinks).toHaveLength(2);
    for (const strategyLink of strategyLinks) {
      expect(strategyLink).toHaveAttribute(
        'href',
        `/markets/${tradeTestOracleId}?source=best-market-finder`,
      );
    }
    expect(screen.getByRole('link', { name: 'Open Proof Mode' })).toHaveAttribute('href', '/proof');
    expect(screen.getByText('Manager + DUSDC')).toBeInTheDocument();
    expect(screen.getByText('Demo evidence')).toBeInTheDocument();
  });

  it('shows pending index and explorer proof only after a submitted digest exists', () => {
    vi.mocked(useWalletStatus).mockReturnValue(walletFixture({ isConnected: true }));
    vi.mocked(usePredictManager).mockReturnValue(managerFixture({ isReady: true }));
    vi.mocked(useManagerSummary).mockReturnValue(
      querySuccess(createTradeManagerSummaryPortfolio()),
    );
    vi.mocked(usePredictOracles).mockReturnValue(querySuccess([createOracleSummary()]));
    vi.mocked(useProofSession).mockReturnValue(
      proofSessionFixture({
        latestSubmittedProof: {
          action: 'MINT',
          affectedObjects: [{ id: tradeTestManagerId, kind: 'manager' }],
          completedDigest: digest,
          confirmedStatus: 'success',
          managerId: tradeTestManagerId,
          oracleId: tradeTestOracleId,
          recordedAtMs: tradeTestNowMs,
          refreshWarning: null,
          sender: tradeTestOwner,
        },
      }),
    );

    render(<JudgeDemoPathPage />);

    expect(screen.getByRole('status', { name: 'Judge demo verdict' })).toHaveTextContent(
      'Pending index',
    );
    expect(screen.getByRole('link', { name: /View transaction Open digest/i })).toHaveAttribute(
      'href',
      expect.stringContaining(digest),
    );
    expect(screen.queryByText(/No submitted digest yet/i)).not.toBeInTheDocument();
  });
});

function installDefaultMocks() {
  vi.mocked(useWalletStatus).mockReturnValue(walletFixture({ isConnected: false }));
  vi.mocked(usePredictManager).mockReturnValue(managerFixture({ isReady: false }));
  vi.mocked(usePredictOracles).mockReturnValue(querySuccess([]));
  vi.mocked(useManagerSummary).mockReturnValue(
    querySuccess(undefined as unknown as ManagerSummaryPortfolioModel),
  );
  vi.mocked(usePositionsSummary).mockReturnValue(
    querySuccess(undefined as unknown as NormalizedManagerPositionsSummaryModel),
  );
  vi.mocked(useTransactionHistory).mockReturnValue({
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    refetch: vi.fn(),
  });
  vi.mocked(useProofSession).mockReturnValue(proofSessionFixture());
}

function walletFixture({ isConnected }: { isConnected: boolean }): WalletStatusModel {
  return {
    accountAddress: isConnected ? tradeTestOwner : null,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected,
    isConnecting: false,
    isDisconnected: !isConnected,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: isConnected ? '0x195b...56c' : null,
    status: isConnected ? 'connected' : 'disconnected',
    statusLabel: isConnected ? 'Connected' : 'Disconnected',
    supportedIntentsCount: 1,
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
    managerId: isReady ? tradeTestManagerId : null,
    matchingManagers: [],
    owner: isReady ? tradeTestOwner : null,
    requiresCreateManager: !isReady,
    status: isReady ? 'READY' : 'NO_MANAGER',
    warnings: [],
  };
}

function createOracleSummary(): OracleSummaryModel {
  const nowMs = Date.now();

  return {
    activatedAtMs: BigInt(nowMs - 10_000),
    createdCheckpoint: 1n,
    expiryMs: BigInt(nowMs + 6 * 3_600_000),
    lifecycleStatus: 'ACTIVE',
    minStrike1e9: 50_000_000_000_000n,
    oracleCapId: tradeTestOracleCapId,
    oracleId: tradeTestOracleId,
    predictId: predictDeploymentConfig.predictObjectId,
    settlementPrice1e9: null,
    settledAtMs: null,
    tickSize1e9: 1_000_000_000n,
    underlyingAsset: 'BTC',
  };
}

function proofSessionFixture(
  overrides: Partial<ProofSessionContextValue> = {},
): ProofSessionContextValue {
  return {
    clearProofSession: vi.fn(),
    latestPreparedReview: null,
    latestSubmittedProof: null,
    recordPreparedProof: vi.fn(),
    recordSubmittedProof: vi.fn(),
    ...overrides,
  };
}
