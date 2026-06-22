import { createContext, useContext } from 'react';
import type { PredictPilotError } from '@/lib/errors';
import type { ObjectId, QuoteAmount, SuiAddress, TransactionDigest } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
  PredictTransactionExecutionResult,
} from '@/types/tx';

export interface ProofPreparedReviewRecord {
  action: PredictTransactionAction;
  affectedObjects: AffectedObjectHint[];
  amountQuote?: QuoteAmount;
  description?: string;
  managerId: ObjectId | null;
  oracleId: ObjectId | null;
  plpAmountAtomic?: bigint;
  preparedAtMs: number;
  quantityQuote?: QuoteAmount;
  sender: SuiAddress;
  simulationStatus: string;
}

export interface ProofSubmittedRecord {
  action: PredictTransactionAction;
  affectedObjects: AffectedObjectHint[];
  amountQuote?: QuoteAmount;
  completedDigest: TransactionDigest;
  confirmedStatus: PredictTransactionExecutionResult['confirmedStatus'];
  description?: string;
  managerId: ObjectId | null;
  oracleId: ObjectId | null;
  plpAmountAtomic?: bigint;
  quantityQuote?: QuoteAmount;
  recordedAtMs: number;
  refreshWarning: PredictPilotError | null;
  sender: SuiAddress;
}

export interface RecordPreparedProofInput {
  builderPreview: {
    action: PredictTransactionAction;
    affectedObjects: AffectedObjectHint[];
    amountQuote?: QuoteAmount;
    plpAmountAtomic?: bigint;
    quantityQuote?: QuoteAmount;
    sender: SuiAddress;
  };
  executionRequest: PredictTransactionExecutionRequest;
  preparedAtMs: number;
  simulationStatus: string;
}

export interface RecordSubmittedProofInput {
  builderPreview: {
    action: PredictTransactionAction;
    affectedObjects: AffectedObjectHint[];
    amountQuote?: QuoteAmount;
    plpAmountAtomic?: bigint;
    quantityQuote?: QuoteAmount;
    sender: SuiAddress;
  };
  executionResult: Extract<PredictTransactionExecutionResult, { status: 'success' }>;
  recordedAtMs: number;
  refreshWarning: PredictPilotError | null;
}

export interface ProofSessionContextValue {
  clearProofSession: () => void;
  latestPreparedReview: ProofPreparedReviewRecord | null;
  latestSubmittedProof: ProofSubmittedRecord | null;
  recordPreparedProof: (input: RecordPreparedProofInput) => void;
  recordSubmittedProof: (input: RecordSubmittedProofInput) => void;
}

const noopContext: ProofSessionContextValue = {
  clearProofSession: () => undefined,
  latestPreparedReview: null,
  latestSubmittedProof: null,
  recordPreparedProof: () => undefined,
  recordSubmittedProof: () => undefined,
};

export const ProofSessionContext = createContext<ProofSessionContextValue>(noopContext);

export function useProofSession() {
  return useContext(ProofSessionContext);
}
