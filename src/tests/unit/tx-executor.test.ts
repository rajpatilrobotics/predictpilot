import { Transaction } from '@mysten/sui/transactions';
import { describe, expect, it, vi } from 'vitest';
import {
  executePredictTransaction,
  type PredictTransactionTransport,
} from '@/lib/tx-executor';
import type { ObjectId, SuiAddress, TransactionDigest } from '@/types/predict';
import type { AffectedObjectHint, PredictTransactionExecutionRequest } from '@/types/tx';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId =
  '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const digest = '9QFneskU8tW7UxQf7tE5qFRfcN4FadtC2Z3HAZkgeETd' as TransactionDigest;

const affectedObjects: AffectedObjectHint[] = [
  { id: managerId, kind: 'manager', label: 'PredictManager' },
  { id: oracleId, kind: 'oracle', label: 'OracleSVI' },
];

function createRequest(): PredictTransactionExecutionRequest {
  return {
    action: 'MINT',
    affectedObjects,
    description: 'Mint binary position',
    sender,
    transaction: new Transaction(),
  };
}

function createTransport(): PredictTransactionTransport {
  return {
    signAndExecuteTransaction: vi.fn(),
  };
}

function createTransportWithWait(): Required<PredictTransactionTransport> {
  return {
    signAndExecuteTransaction: vi.fn(),
    waitForTransaction: vi.fn(),
  };
}

describe('executePredictTransaction', () => {
  it('returns success with digest, action, and affected object hints', async () => {
    const transport = createTransport();
    vi.mocked(transport.signAndExecuteTransaction).mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest,
        effects: {
          status: { success: true },
          transactionDigest: digest,
        },
      },
    });

    const request = createRequest();
    const result = await executePredictTransaction(request, transport);

    expect(transport.signAndExecuteTransaction).toHaveBeenCalledWith({
      include: {
        effects: true,
        events: true,
        objectTypes: true,
      },
      transaction: request.transaction,
    });
    expect(result).toMatchObject({
      action: 'MINT',
      affectedObjects,
      confirmedStatus: 'success',
      description: 'Mint binary position',
      digest,
      sender,
      status: 'success',
    });
  });

  it('maps failed Sui results to transaction failures and preserves digest', async () => {
    const transport = createTransport();
    vi.mocked(transport.signAndExecuteTransaction).mockResolvedValue({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        digest,
        status: {
          error: { command: 2 },
          success: false,
        },
      },
    });

    const result = await executePredictTransaction(createRequest(), transport);

    expect(result).toMatchObject({
      confirmedStatus: 'failure',
      digest,
      error: {
        code: 'TRANSACTION_FAILED',
        context: {
          action: 'MINT',
          digest,
          failureReason: 'Command 2 failed',
          sender,
        },
      },
      status: 'failure',
    });
  });

  it('maps wallet rejection-like errors to transaction rejected', async () => {
    const transport = createTransport();
    vi.mocked(transport.signAndExecuteTransaction).mockRejectedValue(
      new Error('User rejected the request'),
    );

    const result = await executePredictTransaction(createRequest(), transport);

    expect(result).toMatchObject({
      confirmedStatus: 'unknown',
      error: {
        code: 'TRANSACTION_REJECTED',
        kind: 'wallet',
      },
      status: 'failure',
    });
  });

  it('normalizes unknown thrown transport errors safely', async () => {
    const transport = createTransport();
    vi.mocked(transport.signAndExecuteTransaction).mockRejectedValue(new Error('boom'));

    const result = await executePredictTransaction(createRequest(), transport);

    expect(result).toMatchObject({
      confirmedStatus: 'unknown',
      error: {
        code: 'UNKNOWN_ERROR',
        context: {
          action: 'MINT',
          errorName: 'Error',
          sender,
        },
      },
      status: 'failure',
    });
    expect(result.status === 'failure' ? result.error.message : '').not.toContain('boom');
  });

  it('waits for transaction confirmation after a digest and reflects confirmed status', async () => {
    const transport = createTransportWithWait();
    vi.mocked(transport.signAndExecuteTransaction).mockResolvedValue({
      digest,
      effects: {
        status: { success: true },
      },
    });
    vi.mocked(transport.waitForTransaction).mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        digest,
        status: { success: true },
      },
    });

    const result = await executePredictTransaction(createRequest(), transport);

    expect(transport.waitForTransaction).toHaveBeenCalledWith({
      digest,
      include: {
        effects: true,
        events: true,
        objectTypes: true,
      },
    });
    expect(result).toMatchObject({
      confirmedStatus: 'success',
      digest,
      status: 'success',
    });
  });

  it('keeps digest proof and adds a warning when waitForTransaction fails', async () => {
    const transport = createTransportWithWait();
    vi.mocked(transport.signAndExecuteTransaction).mockResolvedValue({
      digest,
      status: { success: true },
    });
    vi.mocked(transport.waitForTransaction).mockRejectedValue(new Error('wait failed'));

    const result = await executePredictTransaction(createRequest(), transport);

    expect(result).toMatchObject({
      confirmedStatus: 'success',
      digest,
      postSubmitWarning: {
        code: 'POST_TX_REFRESH_FAILED',
        context: {
          action: 'MINT',
          digest,
          waitError: 'Error',
        },
      },
      status: 'success',
    });
  });

  it('fails safely when a successful wallet result has no digest', async () => {
    const transport = createTransport();
    vi.mocked(transport.signAndExecuteTransaction).mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        status: { success: true },
      },
    });

    const result = await executePredictTransaction(createRequest(), transport);

    expect(result).toMatchObject({
      confirmedStatus: 'unknown',
      error: {
        code: 'TRANSACTION_FAILED',
        context: {
          action: 'MINT',
          failureReason: 'Wallet returned a successful transaction result without a digest.',
        },
      },
      status: 'failure',
    });
  });
});
