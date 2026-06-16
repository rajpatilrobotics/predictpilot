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

export interface BuildWithdrawFromManagerTxOptions {
  amountQuote?: QuoteAmount | null;
  managerId?: ObjectId | null;
  sender?: SuiAddress | null;
}

export interface WithdrawFromManagerTxPreview {
  action: Extract<PredictTransactionAction, 'WITHDRAW_QUOTE'>;
  affectedObjects: AffectedObjectHint[];
  amountQuote: QuoteAmount;
  description: string;
  expectedNetwork: typeof predictDeploymentConfig.network;
  managerId: ObjectId;
  quoteAsset: PredictQuoteAssetConfig;
  sender: SuiAddress;
  target: typeof predictTxTargets.predictManager.withdraw;
  title: string;
}

export type BuildWithdrawFromManagerTxResult =
  | {
      executionRequest: PredictTransactionExecutionRequest;
      ok: true;
      preview: WithdrawFromManagerTxPreview;
      transaction: Transaction;
    }
  | {
      error: PredictPilotError;
      ok: false;
    };

type ValidatedWithdrawFromManagerInputs =
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

const WITHDRAW_MANAGER_ACTION = 'WITHDRAW_QUOTE' satisfies PredictTransactionAction;
const WITHDRAW_MANAGER_DESCRIPTION =
  'Withdraw manager DUSDC back to the connected wallet.';

export function buildWithdrawFromManagerTx({
  amountQuote,
  managerId,
  sender,
}: BuildWithdrawFromManagerTxOptions = {}): BuildWithdrawFromManagerTxResult {
  const validation = validateWithdrawFromManagerInputs({ amountQuote, managerId, sender });

  if (!validation.ok) {
    return {
      error: validation.error,
      ok: false,
    };
  }

  try {
    const transaction = new Transaction();
    const withdrawnCoin = transaction.moveCall({
      arguments: [transaction.object(validation.managerId), transaction.pure.u64(validation.amountQuote)],
      target: predictTxTargets.predictManager.withdraw,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    });

    transaction.transferObjects([withdrawnCoin], transaction.pure.address(validation.sender));

    const affectedObjects = createWithdrawAffectedObjects(validation.managerId);
    const preview: WithdrawFromManagerTxPreview = {
      action: WITHDRAW_MANAGER_ACTION,
      affectedObjects,
      amountQuote: validation.amountQuote,
      description: WITHDRAW_MANAGER_DESCRIPTION,
      expectedNetwork: predictDeploymentConfig.network,
      managerId: validation.managerId,
      quoteAsset: predictDeploymentConfig.quoteAsset,
      sender: validation.sender,
      target: predictTxTargets.predictManager.withdraw,
      title: 'Withdraw DUSDC from PredictManager',
    };

    return {
      executionRequest: {
        action: WITHDRAW_MANAGER_ACTION,
        affectedObjects,
        description: WITHDRAW_MANAGER_DESCRIPTION,
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
          action: WITHDRAW_MANAGER_ACTION,
          builder: 'buildWithdrawFromManagerTx',
          errorName: error instanceof Error ? error.name : typeof error,
          managerId: validation.managerId,
        },
      }),
      ok: false,
    };
  }
}

function validateWithdrawFromManagerInputs({
  amountQuote,
  managerId,
  sender,
}: BuildWithdrawFromManagerTxOptions): ValidatedWithdrawFromManagerInputs {
  if (!hasConnectedSender(sender)) {
    return {
      error: createAppError('WALLET_NOT_CONNECTED', {
        context: {
          action: WITHDRAW_MANAGER_ACTION,
          builder: 'buildWithdrawFromManagerTx',
        },
      }),
      ok: false,
    };
  }

  if (!hasValidManagerId(managerId)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_MANAGER_ACTION,
          builder: 'buildWithdrawFromManagerTx',
          field: 'managerId',
        },
        message: 'A valid PredictManager object ID is required.',
        recovery: 'Select or create a PredictManager before withdrawing DUSDC.',
      }),
      ok: false,
    };
  }

  if (!hasPositiveQuoteAmount(amountQuote)) {
    return {
      error: createAppError('INVALID_INPUT', {
        context: {
          action: WITHDRAW_MANAGER_ACTION,
          builder: 'buildWithdrawFromManagerTx',
          field: 'amountQuote',
        },
        message: 'Withdraw amount must be greater than zero.',
        recovery: 'Enter a positive DUSDC amount before building the withdraw transaction.',
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

function createWithdrawAffectedObjects(managerId: ObjectId): AffectedObjectHint[] {
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

function hasConnectedSender(sender: BuildWithdrawFromManagerTxOptions['sender']): sender is SuiAddress {
  return typeof sender === 'string' && sender.trim().length > 0;
}

function hasValidManagerId(
  managerId: BuildWithdrawFromManagerTxOptions['managerId'],
): managerId is ObjectId {
  return typeof managerId === 'string' && ObjectIdSchema.safeParse(managerId).success;
}

function hasPositiveQuoteAmount(
  amountQuote: BuildWithdrawFromManagerTxOptions['amountQuote'],
): amountQuote is QuoteAmount {
  return typeof amountQuote === 'bigint' && amountQuote > 0n;
}
