import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { AffectedObjectHint } from '@/types/tx';
import {
  ProofSessionContext,
  type ProofPreparedReviewRecord,
  type ProofSubmittedRecord,
  type RecordPreparedProofInput,
  type RecordSubmittedProofInput,
} from './proof-session-context';

export function ProofSessionProvider({ children }: { children: ReactNode }) {
  const [latestPreparedReview, setLatestPreparedReview] =
    useState<ProofPreparedReviewRecord | null>(null);
  const [latestSubmittedProof, setLatestSubmittedProof] = useState<ProofSubmittedRecord | null>(
    null,
  );

  const clearProofSession = useCallback(() => {
    setLatestPreparedReview(null);
    setLatestSubmittedProof(null);
  }, []);

  const recordPreparedProof = useCallback(
    ({
      builderPreview,
      executionRequest,
      payoffSnapshot,
      preparedAtMs,
      simulationStatus,
    }: RecordPreparedProofInput) => {
      setLatestPreparedReview({
        action: builderPreview.action,
        affectedObjects: builderPreview.affectedObjects,
        amountQuote: builderPreview.amountQuote,
        description: executionRequest.description,
        managerId: getFirstAffectedObjectId(builderPreview.affectedObjects, 'manager'),
        oracleId: getFirstAffectedObjectId(builderPreview.affectedObjects, 'oracle'),
        payoffSnapshot,
        plpAmountAtomic: builderPreview.plpAmountAtomic,
        preparedAtMs,
        quantityQuote: builderPreview.quantityQuote,
        sender: builderPreview.sender,
        simulationStatus,
      });
    },
    [],
  );

  const recordSubmittedProof = useCallback(
    ({
      builderPreview,
      executionResult,
      payoffSnapshot,
      recordedAtMs,
      refreshWarning,
    }: RecordSubmittedProofInput) => {
      setLatestSubmittedProof({
        action: builderPreview.action,
        affectedObjects: executionResult.affectedObjects,
        amountQuote: builderPreview.amountQuote,
        completedDigest: executionResult.digest,
        confirmedStatus: executionResult.confirmedStatus,
        description: executionResult.description,
        managerId: getFirstAffectedObjectId(executionResult.affectedObjects, 'manager'),
        oracleId: getFirstAffectedObjectId(executionResult.affectedObjects, 'oracle'),
        payoffSnapshot,
        plpAmountAtomic: builderPreview.plpAmountAtomic,
        quantityQuote: builderPreview.quantityQuote,
        recordedAtMs,
        refreshWarning,
        sender: builderPreview.sender,
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      clearProofSession,
      latestPreparedReview,
      latestSubmittedProof,
      recordPreparedProof,
      recordSubmittedProof,
    }),
    [
      clearProofSession,
      latestPreparedReview,
      latestSubmittedProof,
      recordPreparedProof,
      recordSubmittedProof,
    ],
  );

  return <ProofSessionContext.Provider value={value}>{children}</ProofSessionContext.Provider>;
}

function getFirstAffectedObjectId(
  affectedObjects: AffectedObjectHint[],
  kind: AffectedObjectHint['kind'],
) {
  return affectedObjects.find((object) => object.kind === kind)?.id ?? null;
}
