import { useMemo, useState } from 'react';
import { ExecutionModal } from '@/components/modals/ExecutionModal';
import { InlineStateNotice, StatePanel } from '@/components/states/StatePrimitives';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import { TerminalMetricCard, TerminalPanel } from '@/components/terminal/TerminalPanels';
import { RiskPreview } from '@/features/tx/RiskPreview';
import { useWalletStatus, type WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import { useBinaryMintFlow } from '@/features/trade/actions/useBinaryMintFlow';
import { useBinaryRedeemFlow } from '@/features/trade/actions/useBinaryRedeemFlow';
import {
  buildBinaryMarketKey,
  buildRangeKey,
  type MarketKeyValidationError,
  type MarketKeyValidationWarning,
} from '@/features/markets/lib/market-keys';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type {
  BinaryDirection,
  QuoteAmount,
  RangePositionAction,
  BinaryPositionAction,
} from '@/types/predict';
import type {
  BinaryPositionSummaryModel,
  ManagerSummaryModel,
  RangePositionModel,
} from '@/types/portfolio';
import type { NormalizedManagerPositionsSummaryModel } from '@/features/portfolio/lib/portfolio-selectors';
import {
  type BinaryTradePreviewModel,
  type BinaryTradePreviewWarning,
} from '@/integrations/deepbook-predict/tx/preview-binary';
import {
  previewRangeTrade,
  type RangeTradePreviewModel,
} from '@/integrations/deepbook-predict/tx/preview-range';
import type { PredictPilotError } from '@/lib/errors';
import { formatLifecycleLabel, formatPrice1e9, formatQuoteAmount } from '@/lib/formatters';

type StrategyMode = 'binary' | 'range';
type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      error: PredictPilotError;
      status: 'blocked';
      warnings: BinaryTradePreviewWarning[];
    }
  | {
      preview: BinaryTradePreviewModel | RangeTradePreviewModel;
      status: 'ready';
    };

export interface StrategyBuilderProps {
  askBounds?: OracleAskBoundsModel;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  positionsSummary?: NormalizedManagerPositionsSummaryModel | null;
  walletStatus?: WalletStatusModel;
}

export function StrategyBuilder({
  askBounds,
  manager,
  managerSummary,
  nowMs,
  oracleState,
  positionsSummary,
  walletStatus,
}: StrategyBuilderProps) {
  const fallbackWalletStatus = useWalletStatus();
  const wallet = walletStatus ?? fallbackWalletStatus;
  const [mode, setMode] = useState<StrategyMode>('binary');
  const [binaryAction, setBinaryAction] = useState<BinaryPositionAction>('MINT');
  const [rangeAction, setRangeAction] = useState<RangePositionAction>('MINT_RANGE');
  const [direction, setDirection] = useState<BinaryDirection>('UP');
  const [strikeInput, setStrikeInput] = useState(() => oracleState.oracle.minStrike1e9.toString());
  const [lowerStrikeInput, setLowerStrikeInput] = useState(() =>
    oracleState.oracle.minStrike1e9.toString(),
  );
  const [higherStrikeInput, setHigherStrikeInput] = useState(() =>
    (oracleState.oracle.minStrike1e9 + oracleState.oracle.tickSize1e9).toString(),
  );
  const [quantityInput, setQuantityInput] = useState('1000000');
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const [initialNowMs] = useState(() => Date.now());
  const effectiveAskBounds = askBounds ?? oracleState.askBounds;
  const renderNowMs = nowMs ?? initialNowMs;
  const binaryMintFlow = useBinaryMintFlow({
    askBounds: effectiveAskBounds,
    manager,
    managerSummary,
    nowMs: renderNowMs,
    oracleState,
    walletStatus: wallet,
  });
  const binaryRedeemFlow = useBinaryRedeemFlow({
    askBounds: effectiveAskBounds,
    manager,
    managerSummary,
    nowMs: renderNowMs,
    oracleState,
    walletStatus: wallet,
  });
  const activeBinaryFlow = binaryAction === 'MINT' ? binaryMintFlow : binaryRedeemFlow;
  const activeBinaryFlowState = activeBinaryFlow.state;
  const activeBinaryFlowTitle =
    binaryAction === 'MINT' ? 'Binary mint execution review' : 'Binary redeem execution review';

  const quantityQuote = parseQuoteAmountInput(quantityInput);
  const binaryKeyResult = useMemo(
    () =>
      buildBinaryMarketKey({
        askBounds: effectiveAskBounds,
        direction,
        oracle: oracleState.oracle,
        strike1e9: strikeInput,
      }),
    [direction, effectiveAskBounds, oracleState.oracle, strikeInput],
  );
  const rangeKeyResult = useMemo(
    () =>
      buildRangeKey({
        askBounds: effectiveAskBounds,
        higherStrike1e9: higherStrikeInput,
        lowerStrike1e9: lowerStrikeInput,
        oracle: oracleState.oracle,
      }),
    [effectiveAskBounds, higherStrikeInput, lowerStrikeInput, oracleState.oracle],
  );
  const activeValidation = mode === 'binary' ? binaryKeyResult : rangeKeyResult;

  function resetPreview() {
    setPreviewState({ status: 'idle' });
  }

  function resetBinaryFlows() {
    binaryMintFlow.reset();
    binaryRedeemFlow.reset();
  }

  async function handlePreviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewState({ status: 'loading' });

    if (mode === 'binary') {
      const marketKey = binaryKeyResult.ok ? binaryKeyResult.key : null;
      const ownedPosition =
        binaryAction === 'REDEEM' && marketKey !== null
          ? findOwnedBinaryPosition(positionsSummary, marketKey)
          : null;
      const result =
        binaryAction === 'MINT'
          ? await binaryMintFlow.beginMintReview({
              marketKey,
              quantityQuote,
            })
          : await binaryRedeemFlow.beginRedeemReview({
              marketKey,
              ownedPosition,
              quantityQuote,
            });

      if (!result.ok) {
        setPreviewState({
          error: result.error,
          status: 'blocked',
          warnings: result.warnings,
        });
        return;
      }

      setPreviewState({ status: 'idle' });
      return;
    }

    const result = await previewRangeTrade({
      action: rangeAction,
      askBounds: effectiveAskBounds,
      higherStrike1e9: higherStrikeInput,
      lowerStrike1e9: lowerStrikeInput,
      manager: managerSummary,
      nowMs: renderNowMs,
      oracleState,
      ownedRangePosition:
        rangeAction === 'REDEEM_RANGE' && rangeKeyResult.ok
          ? findOwnedRangePosition(positionsSummary, rangeKeyResult.key)
          : null,
      quantityQuote,
    });

    if (result.ok) {
      setPreviewState({ preview: result.preview, status: 'ready' });
      return;
    }

    setPreviewState({
      error: result.error,
      status: 'blocked',
      warnings: result.warnings,
    });
  }

  return (
    <section aria-label="Strategy builder workspace" className="space-y-4">
      <TerminalPanel title="Strategy builder">
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <TerminalMetricCard
              helper="Strategy builder reads this from the selected OracleSVI."
              label="Underlying"
              value={oracleState.oracle.underlyingAsset}
            />
            <TerminalMetricCard
              helper="Binary and range mint are blocked outside active oracle windows."
              label="Lifecycle"
              value={formatLifecycleLabel(oracleState.oracle.lifecycleStatus)}
            />
            <TerminalMetricCard
              helper="Raw 1e9-scaled strike floor."
              label="Min strike"
              value={formatPrice1e9(oracleState.oracle.minStrike1e9)}
            />
            <TerminalMetricCard
              helper="Manager DUSDC must already be deposited before minting."
              label="Manager balance"
              value={
                managerSummary === null || managerSummary === undefined
                  ? 'Unavailable'
                  : formatQuoteAmount(managerSummary.tradingBalanceQuote)
              }
            />
          </div>

          <ReadinessNotices manager={manager} managerSummary={managerSummary} wallet={wallet} />

          <form className="grid gap-4" onSubmit={(event) => void handlePreviewSubmit(event)}>
            <fieldset className="grid gap-3 border border-[#d9dfdc] p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
                Mode
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModeButton
                  isActive={mode === 'binary'}
                  label="Binary"
                onClick={() => {
                  setMode('binary');
                  resetPreview();
                  resetBinaryFlows();
                }}
                />
                <ModeButton
                  isActive={mode === 'range'}
                  label="Range"
                onClick={() => {
                  setMode('range');
                  resetPreview();
                  resetBinaryFlows();
                }}
                />
              </div>
            </fieldset>

            {mode === 'binary' ? (
              <BinaryInputs
                action={binaryAction}
                direction={direction}
                onActionChange={(value) => {
                  setBinaryAction(value);
                  resetPreview();
                  resetBinaryFlows();
                }}
                onDirectionChange={(value) => {
                  setDirection(value);
                  resetPreview();
                  resetBinaryFlows();
                }}
                onStrikeChange={(value) => {
                  setStrikeInput(value);
                  resetPreview();
                  resetBinaryFlows();
                }}
                strikeInput={strikeInput}
              />
            ) : (
              <RangeInputs
                action={rangeAction}
                higherStrikeInput={higherStrikeInput}
                lowerStrikeInput={lowerStrikeInput}
                onActionChange={(value) => {
                  setRangeAction(value);
                  resetPreview();
                }}
                onHigherStrikeChange={(value) => {
                  setHigherStrikeInput(value);
                  resetPreview();
                }}
                onLowerStrikeChange={(value) => {
                  setLowerStrikeInput(value);
                  resetPreview();
                }}
              />
            )}

            <label className="grid gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
                Quantity (DUSDC atomic)
              </span>
              <input
                className="w-full border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-mono text-[#17211d]"
                inputMode="numeric"
                onChange={(event) => {
                  setQuantityInput(event.target.value);
                  resetPreview();
                  resetBinaryFlows();
                }}
                value={quantityInput}
              />
            </label>

            <ValidationPanel
              errors={activeValidation.ok ? [] : activeValidation.errors}
              warnings={activeValidation.warnings}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                className="border border-[#17211d] bg-[#17211d] px-4 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                Preview strategy
              </button>
              <p className="text-sm leading-6 text-[#53645f]">
                Binary mint and redeem open a pre-sign execution review after simulation. Range
                flows remain preview-only until their later execution tasks.
              </p>
            </div>
          </form>
        </div>
      </TerminalPanel>

      <BinaryTradeFlowStatus action={binaryAction} state={activeBinaryFlowState} />
      {activeBinaryFlowState.simulationPreview === null ? (
        <PreviewResult previewState={previewState} />
      ) : null}
      {activeBinaryFlowState.simulationPreview === null ? null : (
        <ExecutionModal
          completedDigest={activeBinaryFlowState.completedDigest ?? undefined}
          onClose={activeBinaryFlow.closeModal}
          onRequestSignature={
            activeBinaryFlow.canRequestSignature
              ? () => void activeBinaryFlow.requestSignature()
              : undefined
          }
          onSimulate={() => void activeBinaryFlow.rerunSimulation()}
          open={activeBinaryFlowState.modalOpen}
          preview={activeBinaryFlowState.simulationPreview}
          risk={activeBinaryFlowState.riskPreview}
          title={activeBinaryFlowTitle}
        />
      )}
    </section>
  );
}

function BinaryInputs({
  action,
  direction,
  onActionChange,
  onDirectionChange,
  onStrikeChange,
  strikeInput,
}: {
  action: BinaryPositionAction;
  direction: BinaryDirection;
  onActionChange: (value: BinaryPositionAction) => void;
  onDirectionChange: (value: BinaryDirection) => void;
  onStrikeChange: (value: string) => void;
  strikeInput: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Binary action
        </span>
        <select
          className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-medium text-[#17211d]"
          onChange={(event) => onActionChange(event.target.value as BinaryPositionAction)}
          value={action}
        >
          <option value="MINT">Mint binary</option>
          <option value="REDEEM">Redeem binary</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Direction
        </span>
        <select
          className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-medium text-[#17211d]"
          onChange={(event) => onDirectionChange(event.target.value as BinaryDirection)}
          value={direction}
        >
          <option value="UP">UP</option>
          <option value="DOWN">DOWN</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Binary strike
        </span>
        <input
          className="w-full border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-mono text-[#17211d]"
          inputMode="numeric"
          onChange={(event) => onStrikeChange(event.target.value)}
          value={strikeInput}
        />
      </label>
    </div>
  );
}

function RangeInputs({
  action,
  higherStrikeInput,
  lowerStrikeInput,
  onActionChange,
  onHigherStrikeChange,
  onLowerStrikeChange,
}: {
  action: RangePositionAction;
  higherStrikeInput: string;
  lowerStrikeInput: string;
  onActionChange: (value: RangePositionAction) => void;
  onHigherStrikeChange: (value: string) => void;
  onLowerStrikeChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Range action
        </span>
        <select
          className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-medium text-[#17211d]"
          onChange={(event) => onActionChange(event.target.value as RangePositionAction)}
          value={action}
        >
          <option value="MINT_RANGE">Mint range</option>
          <option value="REDEEM_RANGE">Redeem range</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Lower strike
        </span>
        <input
          className="w-full border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-mono text-[#17211d]"
          inputMode="numeric"
          onChange={(event) => onLowerStrikeChange(event.target.value)}
          value={lowerStrikeInput}
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Higher strike
        </span>
        <input
          className="w-full border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-mono text-[#17211d]"
          inputMode="numeric"
          onChange={(event) => onHigherStrikeChange(event.target.value)}
          value={higherStrikeInput}
        />
      </label>
    </div>
  );
}

function ModeButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`border px-4 py-2 text-sm font-semibold ${
        isActive
          ? 'border-[#17211d] bg-[#17211d] text-white'
          : 'border-[#b8c6c0] bg-[#fbfcfc] text-[#315447]'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ReadinessNotices({
  manager,
  managerSummary,
  wallet,
}: {
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  wallet: WalletStatusModel;
}) {
  const notices: Array<{ copy: string; tone: 'blocked' | 'success' | 'warning' }> = [];

  if (!wallet.isConnected) {
    notices.push({
      copy: 'Connect wallet before any future signing flow. This builder can still show input validation.',
      tone: 'blocked',
    });
  } else if (wallet.isWrongNetwork) {
    notices.push({
      copy: `Wrong network. Switch from ${wallet.currentNetwork} to ${wallet.expectedNetwork} before signing.`,
      tone: 'blocked',
    });
  } else {
    notices.push({
      copy: `Wallet ready on ${wallet.expectedNetwork}; binary trades can open a simulated pre-sign review.`,
      tone: 'success',
    });
  }

  if (manager.status === 'READY' && managerSummary !== null && managerSummary !== undefined) {
    notices.push({
      copy: `PredictManager ready with ${formatQuoteAmount(managerSummary.tradingBalanceQuote)} available for trade previews.`,
      tone: 'success',
    });
  } else if (manager.status === 'LOADING' || manager.status === 'CONFIRMING') {
    notices.push({
      copy: 'PredictManager discovery is still loading; previews may remain blocked.',
      tone: 'warning',
    });
  } else {
    notices.push({
      copy: 'PredictManager is not ready. Create or resolve the manager before binary trade execution.',
      tone: 'blocked',
    });
  }

  return (
    <div className="grid gap-2">
      {notices.map((notice) => (
        <InlineStateNotice key={notice.copy} tone={notice.tone}>
          {notice.copy}
        </InlineStateNotice>
      ))}
    </div>
  );
}

function ValidationPanel({
  errors,
  warnings,
}: {
  errors: MarketKeyValidationError[];
  warnings: MarketKeyValidationWarning[];
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <InlineStateNotice tone="success">
        Market key inputs are locally valid. Binary execution still requires simulation before wallet
        signing.
      </InlineStateNotice>
    );
  }

  return (
    <div className="grid gap-2">
      {errors.map((error) => (
        <InlineStateNotice key={`${error.field}:${error.code}`} tone="blocked">
          {error.message}
        </InlineStateNotice>
      ))}
      {warnings.map((warning) => (
        <InlineStateNotice key={warning.code}>{warning.message}</InlineStateNotice>
      ))}
    </div>
  );
}

function PreviewResult({ previewState }: { previewState: PreviewState }) {
  if (previewState.status === 'idle') {
    return (
      <StatePanel
        description="Choose market parameters, then preview. Binary mint and redeem can open the pre-sign modal; range remains preview-only."
        label="Strategy preview idle"
        title="Preview waiting"
        tone="empty"
      />
    );
  }

  if (previewState.status === 'loading') {
    return (
      <StatePanel
        description="Checking local strategy inputs and existing protocol preconditions."
        label="Strategy preview loading"
        title="Previewing strategy"
        tone="loading"
      />
    );
  }

  if (previewState.status === 'ready') {
    return (
      <div className="space-y-4">
        <StatePanel
          description="Risk preview is available from verified inputs. This preview-only path does not request a wallet signature."
          label="Strategy preview ready"
          title="Risk preview ready"
          tone="success"
        />
        <RiskPreview preview={previewState.preview} />
      </div>
    );
  }

  const isTodoVerify = previewState.error.code === 'TODO_VERIFY_PATH_USED';

  return (
    <StatePanel
      description={
        isTodoVerify
          ? 'Inputs reached the estimator boundary. TODO VERIFY / simulation required before any wallet signature.'
          : previewState.error.message
      }
      label="Strategy preview blocked"
      title={isTodoVerify ? 'TODO VERIFY / simulation required' : previewState.error.title}
      tone={isTodoVerify ? 'warning' : 'blocked'}
    >
      <div className="grid gap-3">
        <p>{previewState.error.recovery}</p>
        {previewState.warnings.map((warning) => (
          <InlineStateNotice key={`${warning.code}:${warning.message}`}>
            {warning.message}
          </InlineStateNotice>
        ))}
        <RiskPreview
          preview={{
            action: previewState.error.context?.action?.toString(),
            blockers: [previewState.error.message],
            title: previewState.error.title,
          }}
        />
      </div>
    </StatePanel>
  );
}

function BinaryTradeFlowStatus({
  action,
  state,
}: {
  action: BinaryPositionAction;
  state: ReturnType<typeof useBinaryMintFlow>['state'] | ReturnType<typeof useBinaryRedeemFlow>['state'];
}) {
  if (state.phase === 'idle') {
    return null;
  }

  const actionLabel = action === 'MINT' ? 'mint' : 'redeem';
  const capitalizedActionLabel = actionLabel === 'mint' ? 'Mint' : 'Redeem';

  if (state.phase === 'building' || state.phase === 'simulating') {
    return (
      <StatePanel
        description={`Preparing the binary ${actionLabel} PTB and running simulation before any wallet prompt.`}
        label={`Binary ${actionLabel} execution status`}
        title={
          state.phase === 'building'
            ? `Building binary ${actionLabel} PTB`
            : `Simulating binary ${actionLabel}`
        }
        tone="loading"
      />
    );
  }

  if (state.phase === 'ready') {
    return (
      <StatePanel
        description="Simulation is ready. Review the modal before requesting the wallet signature."
        label={`Binary ${actionLabel} execution status`}
        title={`Binary ${actionLabel} ready for signature`}
        tone="success"
      />
    );
  }

  if (state.phase === 'signing') {
    return (
      <StatePanel
        description="Wallet signature request is in progress. Do not resubmit this PTB while the wallet is open."
        label={`Binary ${actionLabel} execution status`}
        title="Waiting for wallet signature"
        tone="loading"
      />
    );
  }

  if (state.phase === 'success' && state.completedDigest !== null) {
    return (
      <StatePanel
        description="The wallet returned a transaction digest. PredictPilot invalidated affected manager, oracle, and history reads."
        label={`Binary ${actionLabel} execution status`}
        title={`Binary ${actionLabel} transaction submitted`}
        tone="success"
      >
        <div className="grid gap-2">
          <p>
            Digest:{' '}
            <TxDigestLink
              className="font-semibold underline underline-offset-2"
              digest={state.completedDigest}
            />
          </p>
          {state.refreshWarning === null ? null : (
            <InlineStateNotice tone="warning">{state.refreshWarning.message}</InlineStateNotice>
          )}
        </div>
      </StatePanel>
    );
  }

  return (
    <StatePanel
      description={state.error?.message ?? `Binary ${actionLabel} could not continue.`}
      label={`Binary ${actionLabel} execution status`}
      title={state.error?.title ?? `${capitalizedActionLabel} blocked`}
      tone={state.error?.code === 'TRANSACTION_REJECTED' ? 'warning' : 'blocked'}
    >
      {state.error === null ? null : <p>{state.error.recovery}</p>}
      {state.completedDigest === null ? null : (
        <p>
          Digest:{' '}
          <TxDigestLink
            className="font-semibold underline underline-offset-2"
            digest={state.completedDigest}
          />
        </p>
      )}
    </StatePanel>
  );
}

function findOwnedBinaryPosition(
  positionsSummary: NormalizedManagerPositionsSummaryModel | null | undefined,
  marketKey: BinaryPositionSummaryModel['key'],
) {
  return (
    positionsSummary?.summary.binaryPositions.find(
      (position) =>
        position.key.oracleId === marketKey.oracleId &&
        position.key.expiryMs === marketKey.expiryMs &&
        position.key.strike1e9 === marketKey.strike1e9 &&
        position.key.direction === marketKey.direction,
    ) ?? null
  );
}

function findOwnedRangePosition(
  positionsSummary: NormalizedManagerPositionsSummaryModel | null | undefined,
  rangeKey: RangePositionModel['key'],
) {
  return (
    positionsSummary?.summary.rangePositions.find(
      (position) =>
        position.key.oracleId === rangeKey.oracleId &&
        position.key.expiryMs === rangeKey.expiryMs &&
        position.key.lowerStrike1e9 === rangeKey.lowerStrike1e9 &&
        position.key.higherStrike1e9 === rangeKey.higherStrike1e9,
    ) ?? null
  );
}

function parseQuoteAmountInput(value: string): QuoteAmount | null {
  return /^-?\d+$/.test(value) ? BigInt(value) : null;
}
