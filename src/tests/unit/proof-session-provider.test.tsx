import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProofSessionProvider } from '@/features/proof/ProofSessionProvider';
import {
  useProofSession,
  type RecordSubmittedProofInput,
} from '@/features/proof/proof-session-context';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';

const sender = '0x24d9eb057f4f8597ae9362997a73d8406981a0c5fc96ed7b0ab7c7af3fa9d19b' as SuiAddress;
const managerId = '0x8582108550fb82fb859b3ca3371869147fee58f1d0cce11f99d2704bf42f905a' as ObjectId;
const digest = '7jnrG6TaPH6vFgmxTeZyiXShsZwXywfQ8iAtVi9sVg19' as TransactionDigest;

describe('ProofSessionProvider', () => {
  it('records local prepared reviews without creating submitted digest proof', () => {
    const { result } = renderHook(() => useProofSession(), {
      wrapper: ProofSessionProvider,
    });

    act(() => {
      result.current.recordPreparedProof({
        builderPreview: {
          action: 'MINT',
          affectedObjects: [{ id: managerId, kind: 'manager' }],
          quantityQuote: 1_000_000_000n,
          sender,
        },
        executionRequest: {
          action: 'MINT',
          affectedObjects: [{ id: managerId, kind: 'manager' }],
          description: 'Binary mint review',
          sender,
          transaction: {} as never,
        },
        preparedAtMs: 1_791_000_000_000,
        simulationStatus: 'ready',
      });
    });

    expect(result.current.latestPreparedReview?.action).toBe('MINT');
    expect(result.current.latestPreparedReview?.managerId).toBe(managerId);
    expect(result.current.latestSubmittedProof).toBeNull();
  });

  it('records successful execution digest proof and clears session state', () => {
    const { result } = renderHook(() => useProofSession(), {
      wrapper: ProofSessionProvider,
    });
    const submittedInput: RecordSubmittedProofInput = {
      builderPreview: {
        action: 'MINT',
        affectedObjects: [{ id: managerId, kind: 'manager' }],
        sender,
      },
      executionResult: {
        action: 'MINT',
        affectedObjects: [{ id: managerId, kind: 'manager' }],
        confirmedStatus: 'success',
        digest,
        sender,
        status: 'success',
      },
      recordedAtMs: 1_791_000_010_000,
      refreshWarning: null,
    };

    act(() => {
      result.current.recordSubmittedProof(submittedInput);
    });

    expect(result.current.latestSubmittedProof?.completedDigest).toBe(digest);
    expect(result.current.latestSubmittedProof?.managerId).toBe(managerId);

    act(() => {
      result.current.clearProofSession();
    });

    expect(result.current.latestPreparedReview).toBeNull();
    expect(result.current.latestSubmittedProof).toBeNull();
  });
});
