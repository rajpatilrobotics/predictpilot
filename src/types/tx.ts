import type { Transaction } from '@mysten/sui/transactions';
import type { PredictPilotError } from '@/lib/errors';
import type { ObjectId, PredictUserAction, SuiAddress, TransactionDigest } from '@/types/predict';

export type PredictTransactionAction = PredictUserAction;

export type AffectedObjectKind =
  | 'manager'
  | 'oracle'
  | 'plp-coin'
  | 'predict'
  | 'unknown'
  | 'vault'
  | 'wallet-coin';

export interface AffectedObjectHint {
  id?: ObjectId;
  kind: AffectedObjectKind;
  label?: string;
}

export type PredictTransactionConfirmedStatus = 'failure' | 'success' | 'unknown';

export interface PredictTransactionExecutionRequest {
  action: PredictTransactionAction;
  affectedObjects?: AffectedObjectHint[];
  description?: string;
  sender: SuiAddress;
  transaction: Transaction;
}

export type PredictTransactionExecutionResult =
  | {
      action: PredictTransactionAction;
      affectedObjects: AffectedObjectHint[];
      confirmedStatus: PredictTransactionConfirmedStatus;
      description?: string;
      digest: TransactionDigest;
      postSubmitWarning?: PredictPilotError;
      sender: SuiAddress;
      status: 'success';
    }
  | {
      action: PredictTransactionAction;
      affectedObjects: AffectedObjectHint[];
      confirmedStatus: PredictTransactionConfirmedStatus;
      description?: string;
      digest?: TransactionDigest;
      error: PredictPilotError;
      sender: SuiAddress;
      status: 'failure';
    };
