import { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig, type PredictQuoteAssetConfig } from '@/config/predict';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { createAppError, type PredictPilotError } from '@/lib/errors';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';
import type {
  AffectedObjectHint,
  PredictTransactionAction,
  PredictTransactionExecutionRequest,
} from '@/types/tx';
import { predictProtocolTypes, predictTxTargets } from '../targets';

export interface BuildDepositToManagerTxOptions {
  amountQuote?: QuoteAmount | null;
  managerId?: ObjectId | null;
  sender?: SuiAddress | null;
}

export interface DepositToManagerTxPreview {
  action: Extract<PredictTransactionAction, 'DEPOSIT_QUOTE'>;
  affectedObjects: AffectedObjectHint[];
  amountQuote: QuoteAmount;
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  managerId: ObjectId;
  quoteAsset: PredictQuoteAssetConfig;
  sender: SuiAddress;
  target: typeof predictTxTargets.predictManager.deposit;
  title: string;
}

export type BuildDepositToManagerTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: DepositToManagerTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedDepositToManagerInputs =
  | {
      amountQuote: QuoteAmount;
      managerId: ObjectId;
      ok: true;
      sender: SuiAddress;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

const DEPOSIT_MANAGER_ACTION = 'DEPOSIT_QUOTE' satisfies PredictTransactionAction;
const DEPOSIT_MANAGER_DESCRIPTION =
  'Deposit wallet DUSDC into the selected PredictManager before trading.';

export function buildDepositToManagerTx({
  amountQuote,
  managerId,
  sender,
}: BuildDepositToManagerTxOptions = {}): BuildDepositToManagerTxResult {
  const validation = validateDepositToManagerInputs({ amountQuote, managerId, sender });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const depositCoin = transaction.coin({
      balance: validation.amountQuote,
      type: predictProtocolTypes.quoteAssetType,
    });

    transaction.moveCall({
      arguments: [transaction.object(validation.managerId), depositCoin],
      target: predictTxTargets.predictManager.deposit,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    });

    const affectedObjects = createDepositAffectedObjects(validation.managerId);
    const preview: DepositToManagerTxPreview = {
      action: DEPOSIT_MANAGER_ACTION,
      affectedObjects,
      amountQuote: validation.amountQuote,
      description: DEPOSIT_MANAGER_DESCRIPTION,
      expectedNetwork: predictDeploymentConfig.network,
      managerId: validation.managerId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender: validation.sender,
      target: predictTxTargets.predictManager.deposit,
      title: 'Deposit DUSDC to PredictManager',
    };

    return {
      executionRequest: {
        action: DEPOSIT_MANAGER_ACTION,
        affectedObjects,
        description: DEPOSIT_MANAGER_DESCRIPTION,
        sender: validation.sender,
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
          action: DEPOSIT_MANAGER_ACTION,
          builder: 'buildDepositToManagerTx',
          errorName: error instanceof Error ? error.name : typeof error,
          managerId: validation.managerId,
        },
      }),
      ok: false,
    };
  }
}

function validateDepositToManagerInputs({
  amountQuote,
  managerId,
  sender,
}: BuildDepositToManagerTxOptions): ValidatedDepositToManagerInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: DEPOSIT_MANAGER_ACTION,
          builder: 'buildDepositToManagerTx',
        },
      }),
      ok: false,
    };
  }

  if (!hasValidManagerId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: DEPOSIT_MANAGER_ACTION,
          builder: 'buildDepositToManagerTx',
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: 'Select or create a PredictManager before depositing DUSDC.',
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(amountQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: DEPOSIT_MANAGER_ACTION,
          builder: 'buildDepositToManagerTx',
          field: 'amountQuote',
        },
        message: 'Deposit amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before building the deposit transaction.',
      }),
      ok: false,
    };
  }

  return {
    amountQuote,
    managerId,
    ok: true,
    sender,
  };
}

function createDepositAffectedObjects(managerId: ObjectId): AffectedObjectHint[] {
  return [
    {
      id: managerId,
      kind: 'manager',
      label: 'PredictManager',
    },
    {
      kind: 'wallet-coin',
      label: 'Wallet DUSDC',
    },
  ];
}

function hasConnectedSender(
  sender: BuildDepositToManagerTxOptions['sender'],
): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidManagerId(
  managerId: BuildDepositToManagerTxOptions['managerId'],
): managerId is ObjectId {
  return typeof managerId === 'string' && ObjectIdSchema.safeParse(managerId).success;
}

function hasPositiveQuoteAmount(
  amountQuote: BuildDepositToManagerTxOptions['amountQuote'],
): amountQuote is QuoteAmount {
  return typeof amountQuote === 'bigint' && amountQuote > 0n;
}
