import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProofModePage } from '@/features/proof/ProofModePage';
import type { ProofSessionContextValue } from '@/features/proof/proof-session-context';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';

const walletAddress =
  '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const managerId = '0x8582108550fb82fb859b3ca3371869147fee58f1d0cce11f99d2704bf42f905a' as ObjectId;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

let walletMock: WalletStatusModel;
let managerMock: UsePredictManagerResult;
let proofSessionMock: ProofSessionContextValue;

vi.mock('@/features/wallet/useWalletStatus', () => ({
  useWalletStatus: () => walletMock,
}));

vi.mock('@/features/manager/hooks/usePredictManager', () => ({
  usePredictManager: () => managerMock,
}));

vi.mock('@/features/portfolio/hooks/useManagerSummary', () => ({
  useManagerSummary: () => ({
    data: undefined,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/portfolio/hooks/usePositionsSummary', () => ({
  usePositionsSummary: () => ({
    data: undefined,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/history/hooks/useTransactionHistory', () => ({
  useTransactionHistory: () => ({
    data: {
      records:
        proofSessionMock.latestSubmittedProof === null
          ? []
          : [{ digest, kind: 'BINARY_MINT', timestampMs: 1_791_000_000_000n }],
      totalCount: proofSessionMock.latestSubmittedProof === null ? 0 : 1,
    },
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/proof/proof-session-context', () => ({
  useProofSession: () => proofSessionMock,
}));

describe('ProofModePage', () => {
  beforeEach(() => {
    walletMock = walletFixture({ isConnected: false });
    managerMock = managerFixture({ isReady: false });
    proofSessionMock = proofSessionFixture();
  });

  it('renders blocked copy for disconnected wallets without fake digest or enabled copy', () => {
    render(<ProofModePage />);

    expect(screen.getByRole('heading', { name: 'Proof Mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proof blocked' })).toBeInTheDocument();
    expect(screen.getAllByText(/No submitted transaction/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status', { name: 'Payoff recap unavailable' })).toHaveTextContent(
      'Payoff recap unavailable',
    );
    expect(screen.queryByRole('link', { name: /View transaction/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy proof summary/i })).toBeDisabled();
  });

  it('renders verified digest evidence and copies the proof summary', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    walletMock = walletFixture({ isConnected: true });
    managerMock = managerFixture({ isReady: true });
    proofSessionMock = proofSessionFixture({
      latestSubmittedProof: {
        action: 'MINT',
        affectedObjects: [{ id: managerId, kind: 'manager' }],
        completedDigest: digest,
        confirmedStatus: 'success',
        managerId,
        oracleId: null,
        payoffSnapshot: {
          action: 'MINT',
          direction: 'UP',
          expiryMs: 1_791_003_600_000n,
          kind: 'binary',
          managerBalanceQuote: 5_000_000n,
          oracleId: '0xca4663000000000000000000000000000000000000000000000000000066775a',
          oracleStatus: 'ACTIVE',
          quantityQuote: 1_000_000n,
          strike1e9: 50_000_000_000_000n,
          underlyingAsset: 'BTC',
        },
        recordedAtMs: 1_791_000_000_000,
        refreshWarning: null,
        sender: walletAddress,
      },
    });

    render(<ProofModePage />);

    expect(screen.getByRole('heading', { name: 'Proof verified' })).toBeInTheDocument();
    expect(screen.getByText(/UP wins if settlement > strike/i)).toBeInTheDocument();
    expect(screen.getAllByText(digest).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open explorer proof/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /request wallet signature/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy proof summary/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain('PREDICTPILOT PROOF SUMMARY');
    expect(writeText.mock.calls[0]?.[0]).toContain(`Digest [C]: ${digest}`);
    expect(screen.getByText('Proof summary copied.')).toBeInTheDocument();
  });
});

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
