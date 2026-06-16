import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig } from '@/config/predict';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictTxTargets } from '../targets';

export interface BuildCreateManagerTxOptions {
  sender?: SuiAddress | null;
}

export interface CreateManagerTxPreview {
  action: Extract<PredictTransactionAction, 'CREATE_MANAGER'>;
  affectedObjects: AffectedObjectHint[];
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  managerIdResolution: 'after-confirmation';
  sender: SuiAddress;
  target: typeof predictTxTargets.predict.createManager;
  title: string;
}

export type BuildCreateManagerTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: CreateManagerTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const CREATE_MANAGER_ACTION = 'CREATE_MANAGER' satisfies PredictTransactionAction;
const CREATE_MANAGER_DESCRIPTION =
  'Create a PredictManager. The manager ID is resolved only after transaction confirmation.';

export function buildCreateManagerTx({
  sender,
}: BuildCreateManagerTxOptions = {}): BuildCreateManagerTxResult {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: CREATE_MANAGER_ACTION,
          builder: 'buildCreateManagerTx',
        },
      }),
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();

    transaction.moveCall({
      arguments: [],
      target: predictTxTargets.predict.createManager,
    });

    const affectedObjects = createManagerAffectedObjects();
    const preview: CreateManagerTxPreview = {
      action: CREATE_MANAGER_ACTION,
      affectedObjects,
      description: CREATE_MANAGER_DESCRIPTION,
      expectedNetwork: predictDeploymentConfig.network,
      managerIdResolution: 'after-confirmation',
      sender,
      target: predictTxTargets.predict.createManager,
      title: 'Create PredictManager',
    };

    return {
      executionRequest: {
        action: CREATE_MANAGER_ACTION,
        affectedObjects,
        description: CREATE_MANAGER_DESCRIPTION,
        sender,
        transaction,
      },
      ok: true,
      preview,
      transaction,
    };
  } catch (error) {
    return {
      error: createAppError('PTB_BUILD_FAILED', {
        context: {
          action: CREATE_MANAGER_ACTION,
          builder: 'buildCreateManagerTx',
          errorName: error instanceof Error ? error.name : typeof error,
        },
      }),
      ok: false,
    };
  }
}

function createManagerAffectedObjects(): AffectedObjectHint[] {
  return [
    {
      id: predictDeploymentConfig.predictObjectId,
      kind: 'predict',
      label: 'Predict',
    },
  ];
}

function hasConnectedSender(sender: BuildCreateManagerTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}
