import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { ExecutionModal } from '@/components/modals/ExecutionModal';
import { RiskPreview } from '@/features/tx/RiskPreview';
import { TransactionPreview } from '@/features/tx/TransactionPreview';
import { predictProtocolTypes } from '@/integrations/deepbook-predict/targets';
import type {
  PredictPtbSimulationPreview,
  PredictSimulationIntent,
  PredictSimulationSummary,
} from '@/integrations/deepbook-predict/tx/simulate';
import { createAppError } from '@/lib/errors';
import type { ObjectId, SuiAddress } from '@/types/predict';

const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;

describe('PP-048 transaction preview UI', () => {
  it('enables wallet signature only for ready simulation previews', () => {
    const onRequestSignature = vi.fn();

    render(
      <TransactionPreview onRequestSignature={onRequestSignature} preview={createReadyPreview()} />,
    );

    const signButton = screen.getByRole('button', { name: 'Request wallet signature' });
    expect(signButton).toBeEnabled();

    fireEvent.click(signButton);
    expect(onRequestSignature).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['blocked', createBlockedPreview()],
    ['error', createErrorPreview()],
    ['TODO_VERIFY_BLOCKED', createTodoVerifyPreview()],
  ] satisfies Array<[string, PredictPtbSimulationPreview]>)(
    'disables wallet signature for %s previews and shows recovery copy',
    (_status, preview) => {
      const onRequestSignature = vi.fn();

      render(<TransactionPreview onRequestSignature={onRequestSignature} preview={preview} />);

      const signButton = screen.getByRole('button', { name: 'Request wallet signature' });
      expect(signButton).toBeDisabled();
      fireEvent.click(signButton);
      expect(onRequestSignature).not.toHaveBeenCalled();
      if (!('error' in preview)) {
        throw new Error('Expected blocked preview fixture with an app error.');
      }
      expect(screen.getByText(preview.error.recovery)).toBeInTheDocument();
    },
  );

  it('shows intent and simulation warnings in the transaction preview', () => {
    render(<TransactionPreview preview={createReadyPreview()} />);

    const warnings = screen.getByRole('list', { name: 'Transaction warnings' });
    expect(
      within(warnings).getByText('Ask bounds are present but not fully decoded.'),
    ).toBeInTheDocument();
    expect(
      within(warnings).getByText('Simulation returned no balance changes.'),
    ).toBeInTheDocument();
  });

  it('shows estimated cost and payout risk rows without inventing values', () => {
    const { rerender } = render(
      <RiskPreview
        preview={{
          action: 'MINT',
          askBoundsStatus: 'PRESENT_UNMAPPED',
          estimatedCostQuote: 250_000n,
          expiryMs: 1_787_654_321_000,
          managerBalanceQuote: 1_000_000n,
          managerId,
          oracleFreshness: 'FRESH',
          oracleId,
          oracleStatus: 'ACTIVE',
          quantityQuote: 100_000n,
          quoteAsset: { symbol: 'DUSDC' },
          underlyingAsset: 'BTC',
          warnings: ['Oracle should be refreshed before signing.'],
        }}
      />,
    );

    expect(screen.getByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('250000 DUSDC')).toBeInTheDocument();

    rerender(
      <RiskPreview
        preview={{
          action: 'REDEEM',
          estimatedPayoutQuote: 125_000n,
          quantityQuote: 100_000n,
          quoteAsset: { symbol: 'DUSDC' },
        }}
      />,
    );

    expect(screen.getByText('Estimated payout')).toBeInTheDocument();
    expect(screen.getByText('125000 DUSDC')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable / TODO VERIFY').length).toBeGreaterThan(0);
  });

  it('renders honest fallback copy when optional risk data is missing', () => {
    render(<RiskPreview preview={{ action: 'MINT' }} />);

    expect(screen.getByText('Simulation required')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable / TODO VERIFY').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Missing optional risk data is shown as unavailable instead of estimated/i),
    ).toBeInTheDocument();
  });

  it('renders completed digest links through Sui Explorer helpers', () => {
    render(
      <TransactionPreview
        completedDigest="9QFneskU8tW7UxQf7tE5qFRfcN4FadtC2Z3HAZkgeETd"
        preview={createReadyPreview()}
      />,
    );

    const link = screen.getByRole('link', { name: /View transaction/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(link).toHaveAttribute('href', expect.stringContaining('/txblock/'));
  });

  it('fires modal callbacks only from explicit user actions', () => {
    const onClose = vi.fn();
    const onRequestSignature = vi.fn();
    const onSimulate = vi.fn();

    const { rerender } = render(
      <ExecutionModal
        onClose={onClose}
        onRequestSignature={onRequestSignature}
        onSimulate={onSimulate}
        open
        preview={createReadyPreview()}
        risk={{ action: 'MINT', estimatedCostQuote: 250_000n }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Execution review' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onRequestSignature).not.toHaveBeenCalled();
    expect(onSimulate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request wallet signature' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close execution review' }));

    expect(onSimulate).toHaveBeenCalledTimes(1);
    expect(onRequestSignature).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ExecutionModal onClose={onClose} open={false} preview={createReadyPreview()} />);

    expect(screen.queryByRole('dialog', { name: 'Execution review' })).not.toBeInTheDocument();
  });

  it('keeps keyboard focus inside the execution modal and closes with Escape', () => {
    const onClose = vi.fn();

    render(
      <ExecutionModal
        onClose={onClose}
        onRequestSignature={vi.fn()}
        onSimulate={vi.fn()}
        open
        preview={createReadyPreview()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Execution review' });
    const closeButton = screen.getByRole('button', { name: 'Close execution review' });
    const signButton = screen.getByRole('button', { name: 'Request wallet signature' });

    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(signButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function createReadyPreview(): PredictPtbSimulationPreview {
  return {
    intent: createIntent(),
    simulation: createSimulationSummary(),
    status: 'ready',
  };
}

function createBlockedPreview(): PredictPtbSimulationPreview {
  return {
    error: createAppError('SIMULATION_FAILED'),
    intent: createIntent(),
    simulation: createSimulationSummary({ effectsStatus: 'failure', rawKind: 'FailedTransaction' }),
    status: 'blocked',
  };
}

function createErrorPreview(): PredictPtbSimulationPreview {
  return {
    error: createAppError('PREDICT_SERVER_UNAVAILABLE'),
    intent: createIntent(),
    status: 'error',
  };
}

function createTodoVerifyPreview(): PredictPtbSimulationPreview {
  return {
    error: createAppError('TODO_VERIFY_PATH_USED'),
    intent: createIntent(),
    status: 'TODO_VERIFY_BLOCKED',
  };
}

function createIntent(overrides: Partial<PredictSimulationIntent> = {}): PredictSimulationIntent {
  return {
    action: 'MINT',
    affectedObjects: [
      { id: predictDeploymentConfig.predictObjectId, kind: 'predict', label: 'Predict' },
      { id: managerId, kind: 'manager', label: 'PredictManager' },
      { id: oracleId, kind: 'oracle', label: 'OracleSVI' },
    ],
    assets: [
      {
        amount: 100_000n,
        role: 'quantity',
        type: predictProtocolTypes.quoteAssetType,
      },
      {
        amount: 250_000n,
        role: 'expected-cost',
        type: predictProtocolTypes.quoteAssetType,
      },
    ],
    configIds: {
      network: 'testnet',
      packageId: predictDeploymentConfig.packageId,
      plpType: predictProtocolTypes.plpType,
      predictObjectId: predictDeploymentConfig.predictObjectId,
      quoteAssetType: predictProtocolTypes.quoteAssetType,
    },
    expectedCostQuote: 250_000n,
    managerId,
    oracleId,
    sender,
    warnings: ['Ask bounds are present but not fully decoded.'],
    ...overrides,
  };
}

function createSimulationSummary(
  overrides: Partial<PredictSimulationSummary> = {},
): PredictSimulationSummary {
  return {
    balanceChangeCount: 0,
    changedObjectTypeCount: 1,
    commandResultCount: 2,
    commandResults: [
      {
        commandIndex: 0,
        mutatedReferenceCount: 0,
        returnValueCount: 1,
      },
      {
        commandIndex: 1,
        mutatedReferenceCount: 2,
        returnValueCount: 0,
      },
    ],
    digest: 'simulation-digest',
    effectsStatus: 'success',
    eventCount: 1,
    rawKind: 'Transaction',
    warnings: ['Simulation returned no balance changes.'],
    ...overrides,
  };
}
