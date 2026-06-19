import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import { ExecutionModal } from '@/components/modals/ExecutionModal';
import {
  InlineStateNotice,
  StatePanel,
  StateSkeletonGrid,
} from '@/components/states/StatePrimitives';
import {
  ManagerIdList,
  TerminalDatum,
  TerminalMetricCard,
  TerminalNextSteps,
  TerminalPanel,
} from '@/components/terminal/TerminalPanels';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import { useCreateManagerFlow } from '@/features/manager/actions/useCreateManagerFlow';
import { useManagerDepositFlow } from '@/features/manager/actions/useManagerDepositFlow';
import { useManagerWithdrawFlow } from '@/features/manager/actions/useManagerWithdrawFlow';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import {
  formatWalletAddress,
  useWalletStatus,
  type WalletStatusModel,
} from '@/features/wallet/useWalletStatus';
import {
  getWalletDusdcBalanceQuote,
  vaultWalletBalanceQueryKeys,
} from '@/features/vault/lib/vault-wallet-balances';
import type { PortfolioReadClient } from '@/integrations/deepbook-predict/api/portfolio';
import type { AuthoritativeSuiClient } from '@/integrations/deepbook-predict/onchain/objects';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictPilotError } from '@/lib/errors';
import { formatObjectId, formatQuoteAmount } from '@/lib/formatters';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

export interface PredictManagerPageProps {
  currentNetwork?: string | null;
  executionTransport?: PredictTransactionTransport;
  indexedClient?: PortfolioReadClient;
  onchainClient?: AuthoritativeSuiClient;
  sender?: SuiAddress | null;
  simulationTransport?: PredictSimulationTransport | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
}

type ParsedAmount =
  | {
      amount: QuoteAmount;
      error: null;
      kind: 'valid';
    }
  | {
      amount: null;
      error: null;
      kind: 'empty';
    }
  | {
      amount: null;
      error: string;
      kind: 'invalid';
    };

type ManagerActionFlow =
  | ReturnType<typeof useCreateManagerFlow>
  | ReturnType<typeof useManagerDepositFlow>
  | ReturnType<typeof useManagerWithdrawFlow>;

const quoteSymbol = predictDeploymentConfig.quoteAsset.symbol;

export function PredictManagerPage({
  currentNetwork,
  executionTransport,
  indexedClient,
  onchainClient,
  sender,
  simulationTransport,
  walletDusdcBalanceQuote,
}: PredictManagerPageProps = {}) {
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const wallet = useWalletStatus();
  const manager = usePredictManager({ authoritativeClient: onchainClient, indexedClient });
  const managerId = manager.isReady ? manager.managerId : null;
  const managerSummaryQuery = useManagerSummary({
    client: indexedClient,
    enabled: managerId !== null,
    managerId: managerId ?? undefined,
  });
  const positionsSummaryQuery = usePositionsSummary({
    client: indexedClient,
    enabled: managerId !== null,
    managerId: managerId ?? undefined,
  });
  const effectiveSender = (
    sender === undefined ? wallet.accountAddress : sender
  ) as SuiAddress | null;
  const effectiveNetwork = currentNetwork === undefined ? wallet.currentNetwork : currentNetwork;
  const effectiveWalletStatus = createEffectiveWalletStatus({
    currentNetwork: effectiveNetwork,
    sender: effectiveSender,
    wallet,
  });
  const shouldLoadWalletBalance =
    effectiveSender !== null &&
    effectiveWalletStatus.isConnected &&
    effectiveWalletStatus.isExpectedNetwork;
  const walletDusdcQuery = useQuery({
    enabled: walletDusdcBalanceQuote === undefined && shouldLoadWalletBalance,
    queryFn: () =>
      getWalletDusdcBalanceQuote({
        client: onchainClient,
        owner: effectiveSender as SuiAddress,
      }),
    queryKey:
      effectiveSender === null
        ? [...vaultWalletBalanceQueryKeys.all, 'quote', 'no-wallet']
        : vaultWalletBalanceQueryKeys.quote(effectiveSender),
  });
  const effectiveWalletDusdcBalance =
    walletDusdcBalanceQuote === undefined
      ? (walletDusdcQuery.data ?? null)
      : walletDusdcBalanceQuote;
  const previousManagerTransactionDigest = manager.authoritativeObject?.previousTransaction ?? null;
  const previousTradingBalanceQuote =
    managerSummaryQuery.data?.balanceSummary.tradingBalanceQuote ?? null;
  const depositAmount = useMemo(
    () => parseDecimalAmount(depositInput, predictDeploymentConfig.quoteDecimals),
    [depositInput],
  );
  const withdrawAmount = useMemo(
    () => parseDecimalAmount(withdrawInput, predictDeploymentConfig.quoteDecimals),
    [withdrawInput],
  );
  const createFlow = useCreateManagerFlow({
    executionTransport,
    hasExistingManager: manager.isReady,
    indexedClient,
    simulationTransport,
    walletStatus: effectiveWalletStatus,
  });
  const depositFlow = useManagerDepositFlow({
    authoritativeClient: onchainClient,
    executionTransport,
    indexedClient,
    managerId,
    previousManagerTransactionDigest,
    previousTradingBalanceQuote,
    simulationTransport,
    walletDusdcBalanceQuote: effectiveWalletDusdcBalance,
    walletStatus: effectiveWalletStatus,
  });
  const withdrawFlow = useManagerWithdrawFlow({
    authoritativeClient: onchainClient,
    executionTransport,
    indexedClient,
    managerId,
    managerSummary: managerSummaryQuery.data ?? null,
    previousManagerTransactionDigest,
    simulationTransport,
    walletStatus: effectiveWalletStatus,
  });
  const activeFlow = selectActiveFlow(createFlow, depositFlow, withdrawFlow);
  const activeFlowTitle = getActiveFlowTitle(activeFlow, createFlow, depositFlow);

  async function handleCreateManager() {
    await createFlow.beginCreateManagerReview(undefined);
  }

  async function handleDeposit() {
    await depositFlow.beginDepositReview({
      amountQuote: depositAmount.kind === 'valid' ? depositAmount.amount : null,
    });
  }

  async function handleWithdraw() {
    await withdrawFlow.beginWithdrawReview({
      amountQuote: withdrawAmount.kind === 'valid' ? withdrawAmount.amount : null,
    });
  }

  return (
    <article aria-labelledby="predict-manager-page-title" className="space-y-5">
      <header className="border-b border-[#d9dfdc] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">Execute</p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1
              className="text-3xl font-semibold tracking-normal text-[#17211d]"
              id="predict-manager-page-title"
            >
              PredictManager
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f625b]">
              Your PredictManager is the reusable DeepBook Predict account that stores DUSDC
              balances and position quantities. Positions are not standalone collectibles.
            </p>
          </div>
          <StatusBadge walletStatus={effectiveWalletStatus} />
        </div>
      </header>

      <ManagerLifecyclePanel manager={manager} onCreateManager={() => void handleCreateManager()} />

      {manager.status === 'ERROR' && manager.error !== null ? (
        <ErrorNotice error={manager.error} title="Manager lookup failed" />
      ) : null}

      {manager.isLoading || manager.isConfirming ? <ManagerLoadingState manager={manager} /> : null}

      {manager.isAmbiguous ? (
        <AmbiguousManagerState
          managerIds={manager.matchingManagers.map((item) => item.managerId)}
        />
      ) : null}

      {manager.requiresCreateManager ? (
        <NoManagerState flow={createFlow} onCreateManager={() => void handleCreateManager()} />
      ) : null}

      {manager.isReady ? (
        <>
          <ManagerOverview
            manager={manager}
            managerSummary={managerSummaryQuery.data ?? null}
            positionsSummary={positionsSummaryQuery.data ?? null}
            walletDusdcBalance={effectiveWalletDusdcBalance}
          />
          {managerSummaryQuery.isLoading || positionsSummaryQuery.isLoading ? (
            <StatePanel
              description="Loading manager balances and positions from the Predict server."
              label="Manager account data loading"
              title="Loading manager account data"
              tone="loading"
            >
              <StateSkeletonGrid count={3} label="Manager account skeleton loading" />
            </StatePanel>
          ) : null}
          {managerSummaryQuery.error !== null ? (
            <ErrorNotice error={managerSummaryQuery.error} title="Manager summary failed to load" />
          ) : null}
          {positionsSummaryQuery.error !== null ? (
            <ErrorNotice
              error={positionsSummaryQuery.error}
              title="Positions summary failed to load"
            />
          ) : null}
          <section className="grid gap-4 xl:grid-cols-2" aria-label="Manager funding actions">
            <ManagerAmountActionPanel
              amountInput={depositInput}
              amountLabel="Deposit amount"
              amountPlaceholder="50.00"
              balanceLabel="Wallet DUSDC"
              balanceValue={effectiveWalletDusdcBalance}
              flow={depositFlow}
              inputError={depositAmount.error}
              isBalanceLoading={walletDusdcQuery.isLoading}
              onAmountChange={setDepositInput}
              onReview={() => void handleDeposit()}
              parsedAmount={depositAmount}
              title="Deposit DUSDC to PredictManager"
            />
            <ManagerAmountActionPanel
              amountInput={withdrawInput}
              amountLabel="Withdraw amount"
              amountPlaceholder="25.00"
              balanceLabel="Manager DUSDC"
              balanceValue={managerSummaryQuery.data?.balanceSummary.tradingBalanceQuote ?? null}
              flow={withdrawFlow}
              inputError={withdrawAmount.error}
              isBalanceLoading={managerSummaryQuery.isLoading}
              onAmountChange={setWithdrawInput}
              onReview={() => void handleWithdraw()}
              parsedAmount={withdrawAmount}
              title="Withdraw DUSDC to wallet"
            />
          </section>
        </>
      ) : null}

      {activeFlow.state.simulationPreview === null ? null : (
        <ExecutionModal
          completedDigest={activeFlow.state.completedDigest ?? undefined}
          executionError={activeFlow.state.error}
          executionNotice={activeFlow.state.executionNotice}
          onClose={activeFlow.closeModal}
          onRequestSignature={
            activeFlow.canRequestSignature ? () => void activeFlow.requestSignature() : undefined
          }
          onSimulate={() => void activeFlow.rerunSimulation()}
          open={activeFlow.state.modalOpen}
          preview={activeFlow.state.simulationPreview}
          risk={activeFlow.state.riskPreview}
          title={activeFlowTitle}
        />
      )}
    </article>
  );
}

function ManagerLifecyclePanel({
  manager,
  onCreateManager,
}: {
  manager: ReturnType<typeof usePredictManager>;
  onCreateManager: () => void;
}) {
  const statusCopy = getManagerStatusCopy(manager);

  return (
    <TerminalPanel title="Manager lifecycle">
      <div className="grid gap-3 md:grid-cols-3">
        <TerminalMetricCard label="Status" value={statusCopy.label} helper={statusCopy.helper} />
        <TerminalMetricCard
          label="Manager ID"
          value={manager.managerId === null ? 'Not selected' : formatObjectId(manager.managerId)}
          helper={manager.managerId ?? 'Create or discover one reusable manager.'}
        />
        <TerminalMetricCard
          label="Owner"
          value={manager.owner === null ? 'No wallet' : formatWalletAddress(manager.owner)}
          helper={manager.owner ?? 'Wallet owner appears after connection.'}
        />
      </div>

      {manager.status === 'NO_WALLET' ? (
        <>
          <InlineStateNotice className="mt-4" tone="blocked">
            Connect a Sui Testnet wallet before creating or inspecting a PredictManager.
          </InlineStateNotice>
          <TerminalNextSteps
            steps={[
              'Connect the funded Testnet wallet through the standard Sui wallet button.',
              'Create one reusable PredictManager, then wait for the manager ID to resolve.',
              'Deposit DeepBook Predict dUSDC before minting binary or range positions.',
            ]}
            title="Manager proof path"
          />
        </>
      ) : null}

      {manager.requiresCreateManager ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="border border-[#17211d] bg-[#17211d] px-4 py-2 text-sm font-semibold text-white"
            onClick={onCreateManager}
            type="button"
          >
            Create PredictManager
          </button>
          <p className="text-sm leading-6 text-[#53645f]">
            A manager ID is resolved only after wallet signing and transaction confirmation.
          </p>
        </div>
      ) : null}

      {manager.warnings.length === 0 ? null : (
        <ul className="mt-4 grid gap-2" aria-label="Manager warnings">
          {manager.warnings.map((warning) => (
            <li key={warning.code}>
              <InlineStateNotice>{warning.message}</InlineStateNotice>
            </li>
          ))}
        </ul>
      )}
    </TerminalPanel>
  );
}

function ManagerOverview({
  manager,
  managerSummary,
  positionsSummary,
  walletDusdcBalance,
}: {
  manager: ReturnType<typeof usePredictManager>;
  managerSummary: ReturnType<typeof useManagerSummary>['data'] | null;
  positionsSummary: ReturnType<typeof usePositionsSummary>['data'] | null;
  walletDusdcBalance: QuoteAmount | null;
}) {
  const authoritativeObject = manager.authoritativeObject;
  const summary = managerSummary?.balanceSummary;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <TerminalPanel title="Account summary">
        <dl className="grid gap-4 md:grid-cols-2">
          <TerminalDatum label="Manager object" value={manager.managerId ?? 'Unavailable'} />
          <TerminalDatum label="Owner" value={manager.owner ?? 'Unavailable'} />
          <TerminalDatum label="Wallet DUSDC" value={formatOptionalQuote(walletDusdcBalance)} />
          <TerminalDatum
            label="Manager DUSDC"
            value={formatOptionalQuote(summary?.tradingBalanceQuote)}
          />
          <TerminalDatum
            label="Account value"
            value={formatOptionalQuote(summary?.accountValueQuote)}
          />
          <TerminalDatum
            label="Open exposure"
            value={formatOptionalQuote(summary?.openExposureQuote)}
          />
          <TerminalDatum
            label="Open binary positions"
            value={(positionsSummary?.openBinaryPositionCount ?? 0).toString()}
          />
          <TerminalDatum
            label="Open range positions"
            value={(positionsSummary?.openRangePositionCount ?? 0).toString()}
          />
        </dl>
      </TerminalPanel>

      <TerminalPanel title="Authoritative object check">
        {authoritativeObject === null ? (
          <StatePanel
            description="Authoritative manager metadata is still loading or unavailable."
            title="Onchain manager check pending"
            tone="warning"
          />
        ) : (
          <dl className="grid gap-3 text-sm">
            <TerminalDatum label="Object type" value={authoritativeObject.type ?? 'Unavailable'} />
            <TerminalDatum label="Object version" value={authoritativeObject.version} />
            <TerminalDatum label="Object digest" value={authoritativeObject.digest} />
            <TerminalDatum
              label="Previous transaction"
              value={authoritativeObject.previousTransaction ?? 'Unavailable'}
            />
          </dl>
        )}
      </TerminalPanel>
    </section>
  );
}

function ManagerAmountActionPanel({
  amountInput,
  amountLabel,
  amountPlaceholder,
  balanceLabel,
  balanceValue,
  flow,
  inputError,
  isBalanceLoading,
  onAmountChange,
  onReview,
  parsedAmount,
  title,
}: {
  amountInput: string;
  amountLabel: string;
  amountPlaceholder: string;
  balanceLabel: string;
  balanceValue: QuoteAmount | null;
  flow: ReturnType<typeof useManagerDepositFlow> | ReturnType<typeof useManagerWithdrawFlow>;
  inputError: string | null;
  isBalanceLoading: boolean;
  onAmountChange: (value: string) => void;
  onReview: () => void;
  parsedAmount: ParsedAmount;
  title: string;
}) {
  const actionStatus = getAmountActionStatus({
    amountInput,
    balanceValue,
    flowPhase: flow.state.phase,
    inputError,
    isBalanceLoading,
    parsedAmount,
  });
  const canOpenReview = actionStatus.kind === 'ready';

  return (
    <section aria-label={title} className="border border-[#d9dfdc] bg-white p-4">
      <div className="flex flex-col gap-2 border-b border-[#edf1ef] pb-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
            Manager funding
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#17211d]">{title}</h2>
        </div>
        <span className="w-fit border border-[#c8d3ce] bg-[#f6faf8] px-2 py-1 text-xs font-semibold text-[#446b5e]">
          Simulation required
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-sm font-semibold text-[#17211d]">
          {amountLabel}
          <input
            className="w-full border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 text-base font-semibold text-[#17211d] outline-none focus:border-[#2f7d62]"
            inputMode="decimal"
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder={amountPlaceholder}
            value={amountInput}
          />
        </label>

        <div className="grid gap-2 border border-[#edf1ef] bg-[#fbfcfc] p-3 text-sm text-[#4f625b]">
          <BalanceRow label={balanceLabel} value={formatOptionalQuote(balanceValue)} />
          <BalanceRow label="Quote asset" value={predictDeploymentConfig.quoteAsset.symbol} />
          <BalanceRow
            label="Exact result"
            value="Confirmed by simulation and post-transaction refresh"
          />
        </div>

        <ActionStatusNotice status={actionStatus} />

        {flow.state.completedDigest === null ? null : (
          <InlineStateNotice tone="success">
            Confirmed digest:{' '}
            <TxDigestLink
              className="font-semibold underline underline-offset-2"
              digest={flow.state.completedDigest}
              label="View transaction"
            />
          </InlineStateNotice>
        )}

        {flow.state.refreshWarning === null ? null : (
          <InlineStateNotice tone="warning">{flow.state.refreshWarning.message}</InlineStateNotice>
        )}

        <button
          className="border border-[#17211d] bg-[#17211d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[#c7d0cc] disabled:bg-[#e8eeeb] disabled:text-[#72817b]"
          disabled={!canOpenReview}
          onClick={onReview}
          type="button"
        >
          Open execution review
        </button>
      </div>
    </section>
  );
}

function NoManagerState({
  flow,
  onCreateManager,
}: {
  flow: ReturnType<typeof useCreateManagerFlow>;
  onCreateManager: () => void;
}) {
  return (
    <StatePanel
      action={
        <button
          className="border border-[#17211d] bg-[#17211d] px-4 py-2 text-sm font-semibold text-white"
          onClick={onCreateManager}
          type="button"
        >
          Create PredictManager
        </button>
      }
      description="No PredictManager was found for this wallet. Create one reusable manager before depositing DUSDC or trading."
      label="No PredictManager found"
      title="No PredictManager found"
      tone="empty"
    >
      {flow.state.completedDigest === null ? null : (
        <InlineStateNotice tone="success">
          Manager creation submitted:{' '}
          <TxDigestLink
            className="font-semibold underline underline-offset-2"
            digest={flow.state.completedDigest}
            label="View transaction"
          />
        </InlineStateNotice>
      )}
    </StatePanel>
  );
}

function ManagerLoadingState({ manager }: { manager: ReturnType<typeof usePredictManager> }) {
  return (
    <StatePanel
      description={
        manager.isConfirming
          ? 'Confirming the selected manager object directly onchain.'
          : 'Looking for an indexed PredictManager owned by the connected wallet.'
      }
      label="Loading PredictManager"
      title="Loading PredictManager"
      tone="loading"
    >
      <StateSkeletonGrid count={3} label="PredictManager skeleton loading" />
    </StatePanel>
  );
}

function AmbiguousManagerState({ managerIds }: { managerIds: ObjectId[] }) {
  return (
    <StatePanel
      description="More than one indexed PredictManager belongs to this wallet. PredictPilot will not auto-select one until ownership semantics are verified."
      label="Ambiguous PredictManager"
      title="Ambiguous PredictManager"
      tone="blocked"
    >
      <ManagerIdList managerIds={managerIds} />
    </StatePanel>
  );
}

function ErrorNotice({ error, title }: { error: PredictPilotError; title: string }) {
  return (
    <StatePanel description={error.message} label={title} title={title} tone="error">
      {error.recovery === undefined ? null : <p>{error.recovery}</p>}
    </StatePanel>
  );
}

function StatusBadge({ walletStatus }: { walletStatus: WalletStatusModel }) {
  const label = walletStatus.isWrongNetwork
    ? `Wrong network: ${walletStatus.currentNetwork ?? 'unknown'}`
    : walletStatus.isConnected
      ? `Sui ${walletStatus.expectedNetwork}`
      : 'Wallet disconnected';

  return (
    <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
      {label}
    </span>
  );
}

function ActionStatusNotice({ status }: { status: AmountActionStatus }) {
  return (
    <InlineStateNotice tone={status.kind === 'ready' ? 'success' : status.kind}>
      {status.message}
    </InlineStateNotice>
  );
}

function BalanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[#64736e]">{label}</span>
      <span className="break-words font-semibold text-[#17211d]">{value}</span>
    </div>
  );
}

type AmountActionStatus =
  | {
      kind: 'blocked';
      message: string;
    }
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'success';
      message: string;
    }
  | {
      kind: 'warning';
      message: string;
    }
  | {
      kind: 'ready';
      message: string;
    };

function getAmountActionStatus({
  amountInput,
  balanceValue,
  flowPhase,
  inputError,
  isBalanceLoading,
  parsedAmount,
}: {
  amountInput: string;
  balanceValue: QuoteAmount | null;
  flowPhase: string;
  inputError: string | null;
  isBalanceLoading: boolean;
  parsedAmount: ParsedAmount;
}): AmountActionStatus {
  if (isBalanceLoading) {
    return { kind: 'warning', message: 'Loading balance before execution review.' };
  }

  if (flowPhase === 'building' || flowPhase === 'simulating') {
    return { kind: 'warning', message: 'Preparing transaction review.' };
  }

  if (flowPhase === 'signing') {
    return { kind: 'warning', message: 'Waiting for wallet signature and confirmation.' };
  }

  if (flowPhase === 'success') {
    return { kind: 'success', message: 'Transaction submitted. Refreshing manager state.' };
  }

  if (inputError !== null) {
    return { kind: 'error', message: inputError };
  }

  if (amountInput.trim() === '' || parsedAmount.kind === 'empty') {
    return { kind: 'warning', message: 'Enter an amount to review this manager action.' };
  }

  if (balanceValue === null) {
    return {
      kind: 'blocked',
      message: 'Balance must be loaded before this action can be reviewed.',
    };
  }

  if (parsedAmount.kind === 'valid' && parsedAmount.amount > balanceValue) {
    return { kind: 'blocked', message: 'Amount exceeds the currently loaded balance.' };
  }

  return { kind: 'ready', message: 'Ready to open the pre-sign execution review.' };
}

function getManagerStatusCopy(manager: ReturnType<typeof usePredictManager>) {
  switch (manager.status) {
    case 'AMBIGUOUS':
      return {
        helper: 'Multiple indexed managers were found; manual resolution is required.',
        label: 'Ambiguous',
      };
    case 'CONFIRMING':
      return {
        helper: 'Indexed manager found; checking the authoritative object.',
        label: 'Confirming',
      };
    case 'ERROR':
      return {
        helper: 'Predict manager lookup failed.',
        label: 'Error',
      };
    case 'LOADING':
      return {
        helper: 'Looking for a manager owned by this wallet.',
        label: 'Loading',
      };
    case 'NO_MANAGER':
      return {
        helper: 'Create one reusable manager before trading.',
        label: 'Create needed',
      };
    case 'NO_WALLET':
      return {
        helper: 'Connect a wallet to discover or create a manager.',
        label: 'No wallet',
      };
    case 'READY':
      return {
        helper: 'One manager is selected and confirmed onchain.',
        label: 'Ready',
      };
  }
}

function selectActiveFlow(
  createFlow: ReturnType<typeof useCreateManagerFlow>,
  depositFlow: ReturnType<typeof useManagerDepositFlow>,
  withdrawFlow: ReturnType<typeof useManagerWithdrawFlow>,
): ManagerActionFlow {
  if (createFlow.state.modalOpen || createFlow.state.phase !== 'idle') {
    return createFlow;
  }

  if (depositFlow.state.modalOpen || depositFlow.state.phase !== 'idle') {
    return depositFlow;
  }

  return withdrawFlow;
}

function getActiveFlowTitle(
  activeFlow: ManagerActionFlow,
  createFlow: ReturnType<typeof useCreateManagerFlow>,
  depositFlow: ReturnType<typeof useManagerDepositFlow>,
) {
  if (activeFlow === createFlow) {
    return 'Create PredictManager execution review';
  }

  if (activeFlow === depositFlow) {
    return 'Manager DUSDC deposit execution review';
  }

  return 'Manager DUSDC withdraw execution review';
}

function createEffectiveWalletStatus({
  currentNetwork,
  sender,
  wallet,
}: {
  currentNetwork: string | null | undefined;
  sender: SuiAddress | null;
  wallet: WalletStatusModel;
}): WalletStatusModel {
  const expectedNetwork = predictDeploymentConfig.network;
  const isConnected = sender !== null;
  const isExpectedNetwork = currentNetwork === expectedNetwork;

  return {
    ...wallet,
    accountAddress: sender,
    currentNetwork: currentNetwork ?? expectedNetwork,
    expectedNetwork,
    isConnected,
    isDisconnected: !isConnected,
    isExpectedNetwork,
    isWrongNetwork: isConnected && !isExpectedNetwork,
    shortAddress: sender === null ? null : formatWalletAddress(sender),
    status: isConnected ? wallet.status : 'disconnected',
    statusLabel: isConnected ? wallet.statusLabel : 'Disconnected',
  };
}

function parseDecimalAmount(value: string, decimals: number): ParsedAmount {
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return { amount: null, error: null, kind: 'empty' };
  }

  if (!/^\d+(\.\d+)?$/.test(trimmedValue)) {
    return {
      amount: null,
      error: 'Enter a positive numeric amount.',
      kind: 'invalid',
    };
  }

  const [whole, fraction = ''] = trimmedValue.split('.');

  if (fraction.length > decimals) {
    return {
      amount: null,
      error: `Use at most ${decimals.toString()} decimal places.`,
      kind: 'invalid',
    };
  }

  const atomicAmount = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);

  if (atomicAmount <= 0n) {
    return {
      amount: null,
      error: 'Amount must be greater than zero.',
      kind: 'invalid',
    };
  }

  return {
    amount: atomicAmount,
    error: null,
    kind: 'valid',
  };
}

function formatOptionalQuote(value: QuoteAmount | null | undefined) {
  return value === null || value === undefined
    ? 'Not loaded'
    : formatQuoteAmount(value, quoteSymbol);
}
