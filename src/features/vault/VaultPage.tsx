import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import { ExecutionModal } from '@/components/modals/ExecutionModal';
import {
  InlineStateNotice,
  StatePanel,
  StateSkeletonGrid,
} from '@/components/states/StatePrimitives';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import {
  formatWalletAddress,
  useWalletStatus,
  type WalletStatusModel,
} from '@/features/wallet/useWalletStatus';
import { useVaultSupplyFlow } from '@/features/vault/actions/useVaultSupplyFlow';
import { useVaultWithdrawFlow } from '@/features/vault/actions/useVaultWithdrawFlow';
import { useVaultPerformance } from '@/features/vault/hooks/useVaultPerformance';
import { useVaultSummary } from '@/features/vault/hooks/useVaultSummary';
import {
  getWalletDusdcBalanceQuote,
  getWalletPlpBalanceAtomic,
  vaultWalletBalanceQueryKeys,
} from '@/features/vault/lib/vault-wallet-balances';
import type { VaultReadClient } from '@/integrations/deepbook-predict/api/vault';
import type { AuthoritativeSuiClient } from '@/integrations/deepbook-predict/onchain/objects';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { PredictPilotError } from '@/lib/errors';
import { formatDecimalBigint } from '@/lib/formatters';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel, VaultPerformanceModel, VaultPerformancePoint } from '@/types/vault';

export interface VaultPageProps {
  currentNetwork?: string | null;
  executionTransport?: PredictTransactionTransport;
  onchainClient?: AuthoritativeSuiClient;
  readClient?: VaultReadClient;
  sender?: SuiAddress | null;
  simulationTransport?: PredictSimulationTransport | null;
  walletDusdcBalanceQuote?: QuoteAmount | null;
  walletPlpBalanceAtomic?: bigint | null;
}

type ParsedAmount =
  | {
      amount: bigint;
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

type VaultExecutionFlowState =
  | ReturnType<typeof useVaultSupplyFlow>['state']
  | ReturnType<typeof useVaultWithdrawFlow>['state'];

export function VaultPage({
  currentNetwork,
  executionTransport,
  onchainClient,
  readClient,
  sender,
  simulationTransport,
  walletDusdcBalanceQuote,
  walletPlpBalanceAtomic,
}: VaultPageProps) {
  const [supplyAmountInput, setSupplyAmountInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const wallet = useWalletStatus();
  const vaultSummaryQuery = useVaultSummary({ client: readClient });
  const vaultPerformanceQuery = useVaultPerformance({ client: readClient });
  const vault = vaultSummaryQuery.data ?? null;
  const vaultReadiness: VaultReadiness = vaultSummaryQuery.isLoading
    ? 'loading'
    : vault === null
      ? 'missing'
      : 'ready';
  const quoteSymbol = predictDeploymentConfig.quoteAsset.symbol;
  const expectedNetwork = predictDeploymentConfig.network;
  const effectiveSender = (sender === undefined ? wallet.accountAddress : sender) as
    | SuiAddress
    | null;
  const effectiveNetwork = currentNetwork === undefined ? wallet.currentNetwork : currentNetwork;
  const networkState = getNetworkState(effectiveNetwork, expectedNetwork);
  const effectiveWalletStatus = createEffectiveWalletStatus({
    networkState,
    sender: effectiveSender,
    wallet,
  });
  const supplyAmount = useMemo(
    () => parseDecimalAmount(supplyAmountInput, predictDeploymentConfig.quoteDecimals),
    [supplyAmountInput],
  );
  const withdrawAmount = useMemo(
    () => parseDecimalAmount(withdrawAmountInput, predictDeploymentConfig.quoteDecimals),
    [withdrawAmountInput],
  );
  const shouldLoadWalletBalances =
    effectiveSender !== null && networkState.status === 'ready' && effectiveWalletStatus.isConnected;
  const walletDusdcBalanceQuery = useQuery({
    enabled: walletDusdcBalanceQuote === undefined && shouldLoadWalletBalances,
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
  const walletPlpBalanceQuery = useQuery({
    enabled: walletPlpBalanceAtomic === undefined && shouldLoadWalletBalances,
    queryFn: () =>
      getWalletPlpBalanceAtomic({
        client: onchainClient,
        owner: effectiveSender as SuiAddress,
      }),
    queryKey:
      effectiveSender === null
        ? [...vaultWalletBalanceQueryKeys.all, 'plp', 'no-wallet']
        : vaultWalletBalanceQueryKeys.plp(effectiveSender),
  });
  const effectiveWalletDusdcBalanceQuote =
    walletDusdcBalanceQuote === undefined
      ? (walletDusdcBalanceQuery.data ?? null)
      : walletDusdcBalanceQuote;
  const effectiveWalletPlpBalanceAtomic =
    walletPlpBalanceAtomic === undefined
      ? (walletPlpBalanceQuery.data ?? null)
      : walletPlpBalanceAtomic;
  const supplyFlow = useVaultSupplyFlow({
    executionTransport,
    simulationTransport,
    vault,
    walletDusdcBalanceQuote: effectiveWalletDusdcBalanceQuote,
    walletStatus: effectiveWalletStatus,
  });
  const withdrawFlow = useVaultWithdrawFlow({
    executionTransport,
    simulationTransport,
    vault,
    walletPlpBalanceAtomic: effectiveWalletPlpBalanceAtomic,
    walletStatus: effectiveWalletStatus,
  });
  const activeFlowState =
    supplyFlow.state.modalOpen || supplyFlow.state.phase !== 'idle'
      ? supplyFlow.state
      : withdrawFlow.state;
  const activeFlow =
    supplyFlow.state.modalOpen || supplyFlow.state.phase !== 'idle' ? supplyFlow : withdrawFlow;
  const activeModalTitle =
    activeFlow === supplyFlow ? 'Vault supply execution review' : 'Vault withdraw execution review';

  async function handleSupplyReview() {
    await supplyFlow.beginSupplyReview({
      amountQuote: supplyAmount.kind === 'valid' ? supplyAmount.amount : null,
    });
  }

  async function handleWithdrawReview() {
    await withdrawFlow.beginWithdrawReview({
      plpAmountAtomic: withdrawAmount.kind === 'valid' ? withdrawAmount.amount : null,
    });
  }

  return (
    <article aria-labelledby="vault-page-title" className="space-y-5">
      <header className="border-b border-[#d9dfdc] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">Assets</p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1
              className="text-3xl font-semibold tracking-normal text-[#17211d]"
              id="vault-page-title"
            >
              Vault / PLP
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f625b]">
              The vault takes the opposite side of every trade. PLP represents LP shares in the
              shared vault.
            </p>
          </div>
          <NetworkBadge networkState={networkState} />
        </div>
      </header>

      {vaultSummaryQuery.isLoading ? <LoadingSummary /> : null}
      {vaultSummaryQuery.isError ? <ErrorNotice error={vaultSummaryQuery.error} /> : null}
      {vault !== null ? <VaultReadyStatus vault={vault} /> : null}

      {vault !== null ? (
        <>
          <VaultMetrics vault={vault} quoteSymbol={quoteSymbol} />
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <VaultPerformancePanel
              error={vaultPerformanceQuery.error ?? null}
              isError={vaultPerformanceQuery.isError}
              isLoading={vaultPerformanceQuery.isLoading}
              performance={vaultPerformanceQuery.data ?? null}
              quoteSymbol={quoteSymbol}
            />
            <VaultExposurePanel vault={vault} quoteSymbol={quoteSymbol} />
          </section>
        </>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Vault LP execution review">
        <LpActionPanel
          amountInput={supplyAmountInput}
          amountLabel="Supply amount"
          amountPlaceholder="100.00"
          emptyWalletCopy="No DUSDC balance loaded for this wallet."
          flowState={supplyFlow.state}
          inputError={supplyAmount.error}
          isWalletBalanceLoading={walletDusdcBalanceQuery.isLoading}
          networkState={networkState}
          onAmountChange={setSupplyAmountInput}
          onReview={() => void handleSupplyReview()}
          parsedAmount={supplyAmount}
          quoteSymbol={quoteSymbol}
          sender={effectiveSender}
          title="Supply vault liquidity"
          vaultReadiness={vaultReadiness}
          walletBalance={effectiveWalletDusdcBalanceQuote}
          walletBalanceLabel="Wallet DUSDC"
        />
        <LpActionPanel
          amountInput={withdrawAmountInput}
          amountLabel="Burn PLP amount"
          amountPlaceholder="50.00"
          emptyWalletCopy="No PLP position yet. Supply DUSDC to the vault to mint PLP shares."
          flowState={withdrawFlow.state}
          inputError={withdrawAmount.error}
          isWalletBalanceLoading={walletPlpBalanceQuery.isLoading}
          networkState={networkState}
          onAmountChange={setWithdrawAmountInput}
          onReview={() => void handleWithdrawReview()}
          parsedAmount={withdrawAmount}
          quoteSymbol={quoteSymbol}
          sender={effectiveSender}
          title="Withdraw vault liquidity"
          vaultReadiness={vaultReadiness}
          walletBalance={effectiveWalletPlpBalanceAtomic}
          walletBalanceLabel="Wallet PLP"
          withdrawContext={vault}
        />
      </section>

      {activeFlowState.simulationPreview === null ? null : (
        <ExecutionModal
          completedDigest={activeFlowState.completedDigest ?? undefined}
          onClose={activeFlow.closeModal}
          onRequestSignature={
            activeFlow.canRequestSignature ? () => void activeFlow.requestSignature() : undefined
          }
          onSimulate={() => void activeFlow.rerunSimulation()}
          open={activeFlowState.modalOpen}
          preview={activeFlowState.simulationPreview}
          risk={activeFlowState.riskPreview}
          title={activeModalTitle}
        />
      )}
    </article>
  );
}

function VaultMetrics({ quoteSymbol, vault }: { quoteSymbol: string; vault: VaultModel }) {
  const liabilityQuote = vault.totalLiabilityQuote ?? vault.totalMtmQuote;

  return (
    <section
      aria-label="Vault summary metrics"
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        label="Vault value"
        value={formatQuote(vault.vaultValueQuote, quoteSymbol)}
        detail={`Balance ${formatQuote(vault.vaultBalanceQuote, quoteSymbol)}`}
      />
      <MetricCard
        label="Available liquidity"
        value={formatQuote(vault.availableLiquidityQuote, quoteSymbol)}
        detail={`Withdrawable ${formatQuote(vault.availableWithdrawalQuote, quoteSymbol)}`}
      />
      <MetricCard
        label="Utilization"
        value={formatPercent(vault.utilizationRatio)}
        detail={`Max payout use ${formatPercent(vault.maxPayoutUtilizationRatio)}`}
      />
      <MetricCard
        label="PLP ownership"
        value={`${formatAtomic(vault.plpTotalSupplyAtomic)} PLP`}
        detail={`Share price ${formatSharePrice(vault.plpSharePrice)} ${quoteSymbol}`}
      />
      <MetricCard
        label="Max payout"
        value={formatQuote(vault.totalMaxPayoutQuote, quoteSymbol)}
        detail="Maximum vault-side payout exposure"
      />
      <MetricCard
        label="MTM liability"
        value={formatQuote(liabilityQuote, quoteSymbol)}
        detail="Current marked vault obligation"
      />
      <MetricCard
        label="Net deposits"
        value={formatQuote(vault.netDepositsQuote, quoteSymbol)}
        detail={`Supplied ${formatQuote(vault.totalSuppliedQuote, quoteSymbol)}`}
      />
      <MetricCard
        label="Total withdrawn"
        value={formatQuote(vault.totalWithdrawnQuote, quoteSymbol)}
        detail="Historical LP quote withdrawals"
      />
    </section>
  );
}

function VaultPerformancePanel({
  error,
  isError,
  isLoading,
  performance,
  quoteSymbol,
}: {
  error: PredictPilotError | null;
  isError: boolean;
  isLoading: boolean;
  performance: VaultPerformanceModel | null;
  quoteSymbol: string;
}) {
  const points = performance?.points ?? [];

  return (
    <section
      aria-labelledby="vault-performance-title"
      className="border border-[#d9dfdc] bg-white p-4"
    >
      <div className="flex flex-col gap-2 border-b border-[#edf1ef] pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
            Performance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#17211d]" id="vault-performance-title">
            Vault performance series
          </h2>
        </div>
        <span className="w-fit border border-[#c8d3ce] bg-[#f6faf8] px-2 py-1 text-xs font-semibold text-[#446b5e]">
          range=ALL
        </span>
      </div>

      {isLoading ? (
        <StatePanel
          className="mt-4"
          description="Loading vault performance from the existing range=ALL hook."
          label="Vault performance loading"
          title="Loading vault performance"
          tone="loading"
        >
          <StateSkeletonGrid
            className="md:grid-cols-1"
            count={1}
            label="Vault performance chart loading"
          />
        </StatePanel>
      ) : null}

      {isError && error !== null ? <ErrorNotice error={error} compact /> : null}

      {!isLoading && !isError && points.length === 0 ? (
        <StatePanel
          className="mt-4"
          description="The vault summary is available, but the performance series for this range is empty."
          title="No performance points yet"
          tone="empty"
        />
      ) : null}

      {!isLoading && !isError && points.length > 0 ? (
        <PerformanceChart points={points} quoteSymbol={quoteSymbol} />
      ) : null}
    </section>
  );
}

function PerformanceChart({
  points,
  quoteSymbol,
}: {
  points: VaultPerformancePoint[];
  quoteSymbol: string;
}) {
  const visiblePoints = getVisiblePerformancePoints(points);
  const values = visiblePoints.map((point) => Number(point.vaultValueQuote));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const latest = points[points.length - 1];

  return (
    <div className="mt-4">
      <div
        aria-label="Vault value performance chart"
        className="flex h-40 min-w-0 items-end gap-px border border-[#edf1ef] bg-[#fbfcfc] p-3"
        role="img"
      >
        {visiblePoints.map((point, index) => {
          const height = 24 + ((Number(point.vaultValueQuote) - min) / spread) * 112;
          return (
            <span
              className="min-w-0 flex-1 bg-[#2f7d62]"
              key={`${point.timestampMs.toString()}-${index}`}
              style={{ height }}
              title={`${formatQuote(point.vaultValueQuote, quoteSymbol)} at ${formatTimestamp(point.timestampMs)}`}
            />
          );
        })}
      </div>
      {points.length > visiblePoints.length ? (
        <p className="mt-2 text-xs leading-5 text-[#64736e]">
          Showing latest {visiblePoints.length} of {points.length} performance points to keep the
          chart readable on mobile.
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <MetricCard
          compact
          label="Latest vault value"
          value={
            latest === undefined ? 'Unavailable' : formatQuote(latest.vaultValueQuote, quoteSymbol)
          }
        />
        <MetricCard
          compact
          label="Latest share price"
          value={latest === undefined ? 'Unavailable' : formatSharePrice(latest.sharePrice)}
        />
        <MetricCard compact label="Points" value={points.length.toString()} />
      </div>
    </div>
  );
}

function getVisiblePerformancePoints(points: VaultPerformancePoint[]) {
  const maxVisiblePoints = 72;

  return points.length <= maxVisiblePoints ? points : points.slice(-maxVisiblePoints);
}

function VaultExposurePanel({ quoteSymbol, vault }: { quoteSymbol: string; vault: VaultModel }) {
  return (
    <section
      aria-labelledby="vault-exposure-title"
      className="border border-[#d9dfdc] bg-white p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
        Risk context
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#17211d]" id="vault-exposure-title">
        Withdrawal limiter status
      </h2>
      <div className="mt-4 space-y-3">
        <ExposureRow
          label="Available withdraw"
          value={formatQuote(vault.availableWithdrawalQuote, quoteSymbol)}
        />
        <ExposureRow
          label="Max payout coverage"
          value={formatQuote(vault.totalMaxPayoutQuote, quoteSymbol)}
        />
        <ExposureRow
          label="Max payout utilization"
          value={formatPercent(vault.maxPayoutUtilizationRatio)}
        />
        <ExposureRow label="Accepted quote asset" value={shortenMoveType(vault.quoteAssetType)} />
      </div>
      <div className="mt-4 border border-[#ead7a7] bg-[#fffaf0] p-3 text-sm leading-6 text-[#664b14]">
        Withdrawals are constrained by current max payout coverage.
      </div>
    </section>
  );
}

function LpActionPanel({
  amountInput,
  amountLabel,
  amountPlaceholder,
  emptyWalletCopy,
  flowState,
  inputError,
  isWalletBalanceLoading,
  networkState,
  onAmountChange,
  onReview,
  parsedAmount,
  quoteSymbol,
  sender,
  title,
  vaultReadiness,
  walletBalance,
  walletBalanceLabel,
  withdrawContext,
}: {
  amountInput: string;
  amountLabel: string;
  amountPlaceholder: string;
  emptyWalletCopy: string;
  flowState: VaultExecutionFlowState;
  inputError: string | null;
  isWalletBalanceLoading: boolean;
  networkState: NetworkState;
  onAmountChange: (value: string) => void;
  onReview: () => void;
  parsedAmount: ParsedAmount;
  quoteSymbol: string;
  sender: SuiAddress | null;
  title: string;
  vaultReadiness: VaultReadiness;
  walletBalance: bigint | null;
  walletBalanceLabel: string;
  withdrawContext?: VaultModel | null;
}) {
  const isSupply = title.toLowerCase().startsWith('supply');
  const hasWalletBalance = walletBalance !== null;
  const isZeroBalance = walletBalance === 0n;
  const status = getExecutionStatus({
    amountInput,
    flowState,
    inputError,
    isWalletBalanceLoading,
    networkState,
    parsedAmount,
    sender,
    vaultReadiness,
    walletBalance,
    withdrawContext,
  });
  const canOpenReview = status.kind === 'ready';
  const builderPreview = flowState.builderPreview;

  return (
    <section
      aria-labelledby={`${isSupply ? 'supply' : 'withdraw'}-vault-title`}
      className="border border-[#d9dfdc] bg-white p-4"
    >
      <div className="flex flex-col gap-2 border-b border-[#edf1ef] pb-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">
            {isSupply ? 'Supply DUSDC' : 'Withdraw DUSDC'}
          </p>
          <h2
            className="mt-1 text-lg font-semibold text-[#17211d]"
            id={`${isSupply ? 'supply' : 'withdraw'}-vault-title`}
          >
            {title}
          </h2>
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
          <ExposureRow
            label={walletBalanceLabel}
            value={
              hasWalletBalance
                ? `${formatAtomic(walletBalance)} ${isSupply ? quoteSymbol : 'PLP'}`
                : 'Not loaded'
            }
          />
          {isSupply ? (
            <ExposureRow label="Expected PLP" value="Simulation or onchain confirmation required" />
          ) : (
            <ExposureRow
              label="Expected DUSDC"
              value="Simulation or onchain confirmation required"
            />
          )}
          {withdrawContext !== undefined && withdrawContext !== null ? (
            <ExposureRow
              label="Available withdraw"
              value={formatQuote(withdrawContext.availableWithdrawalQuote, quoteSymbol)}
            />
          ) : null}
        </div>

        {isZeroBalance ? (
          <div
            className="border border-dashed border-[#c8d3ce] bg-[#fbfcfc] p-3 text-sm text-[#4f625b]"
            role="status"
          >
            {emptyWalletCopy}
          </div>
        ) : null}

        <ExecutionStateView isSupply={isSupply} status={status} />

        <div className="border border-[#ead7a7] bg-[#fffaf0] p-3 text-sm leading-6 text-[#664b14]">
          {isSupply
            ? 'Exact PLP shares out require simulation or onchain confirmation.'
            : 'Exact DUSDC returned requires simulation or onchain confirmation.'}
        </div>

        {builderPreview !== null ? (
          <div className="grid gap-2 border border-[#c8d3ce] bg-[#f6faf8] p-3 text-sm text-[#315447]">
            <ExposureRow label="Prepared action" value={builderPreview.action} />
            <ExposureRow label="Network" value={builderPreview.expectedNetwork} />
            <ExposureRow
              label="Vault value snapshot"
              value={formatQuote(builderPreview.vaultSnapshot.vaultValueQuote, quoteSymbol)}
            />
          </div>
        ) : null}

        {flowState.error !== null ? <ErrorNotice error={flowState.error} compact /> : null}

        <button
          className={`border px-3 py-2 text-sm font-semibold transition ${
            canOpenReview
              ? 'border-[#1d684f] bg-[#1f7a5b] text-white hover:bg-[#185d46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a5b]'
              : 'border-[#b8c6c0] bg-[#eef3f1] text-[#64736e]'
          }`}
          disabled={!canOpenReview}
          onClick={onReview}
          type="button"
        >
          {isSupply ? 'Review supply execution' : 'Review withdraw execution'}
        </button>
      </div>
    </section>
  );
}

function ExecutionStateView({
  isSupply,
  status,
}: {
  isSupply: boolean;
  status: ExecutionStatus;
}) {
  if (status.kind === 'idle') {
    return (
      <InlineStateNotice tone="empty">
        Enter an amount to prepare a simulated {isSupply ? 'supply' : 'withdraw'} execution review.
      </InlineStateNotice>
    );
  }

  if (status.kind === 'loading') {
    return (
      <InlineStateNotice className="animate-pulse" tone="empty">
        Preparing {isSupply ? 'supply' : 'withdraw'} execution review...
      </InlineStateNotice>
    );
  }

  if (status.kind === 'ready') {
    return (
      <InlineStateNotice tone="success">
        {isSupply ? 'Supply review ready.' : 'Withdraw review ready.'} Simulation runs before any
        wallet signature request.
      </InlineStateNotice>
    );
  }

  if (status.kind === 'success') {
    return (
      <InlineStateNotice tone="success">
        <p className="font-semibold">
          {isSupply ? 'Supply transaction submitted.' : 'Withdraw transaction submitted.'}
        </p>
        {status.digest === undefined ? null : (
          <p className="mt-1">
            Digest:{' '}
            <TxDigestLink
              className="font-semibold text-[#1f6f54] underline"
              digest={status.digest}
              label={status.digest}
            />
          </p>
        )}
      </InlineStateNotice>
    );
  }

  return (
    <InlineStateNotice tone={status.kind === 'error' ? 'error' : 'blocked'}>
      <p className="font-semibold">{status.title}</p>
      <p className="mt-1">{status.message}</p>
      {status.recovery === undefined ? null : (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em]">{status.recovery}</p>
      )}
    </InlineStateNotice>
  );
}

type ExecutionStatus =
  | {
      kind: 'blocked';
      message: string;
      recovery?: string;
      title: string;
    }
  | {
      kind: 'error';
      message: string;
      recovery?: string;
      title: string;
    }
  | {
      kind: 'idle';
    }
  | {
      kind: 'loading';
    }
  | {
      kind: 'ready';
    }
  | {
      digest?: string;
      kind: 'success';
    };

type VaultReadiness = 'loading' | 'missing' | 'ready';

function getExecutionStatus({
  amountInput,
  flowState,
  inputError,
  isWalletBalanceLoading,
  networkState,
  parsedAmount,
  sender,
  vaultReadiness,
  walletBalance,
  withdrawContext,
}: {
  amountInput: string;
  flowState: VaultExecutionFlowState;
  inputError: string | null;
  isWalletBalanceLoading: boolean;
  networkState: NetworkState;
  parsedAmount: ParsedAmount;
  sender: SuiAddress | null;
  vaultReadiness: VaultReadiness;
  walletBalance: bigint | null;
  withdrawContext?: VaultModel | null;
}): ExecutionStatus {
  if (amountInput.trim().length === 0) {
    return { kind: 'idle' };
  }

  if (inputError !== null) {
    return {
      kind: 'blocked',
      message: inputError,
      title: 'Invalid amount',
    };
  }

  if (networkState.status === 'wrong-network') {
    return {
      kind: 'blocked',
      message: `Switch to ${networkState.expectedNetwork} before opening vault LP execution review.`,
      title: 'Wrong network',
    };
  }

  if (sender === null) {
    return {
      kind: 'blocked',
      message: 'Connect a Sui wallet on Testnet before opening vault LP execution review.',
      title: 'Wallet required',
    };
  }

  if (vaultReadiness === 'loading') {
    return { kind: 'loading' };
  }

  if (vaultReadiness === 'missing') {
    return {
      kind: 'blocked',
      message: 'Refresh the vault summary before opening vault LP execution review.',
      title: 'Vault state required',
    };
  }

  if (isWalletBalanceLoading) {
    return { kind: 'loading' };
  }

  if (walletBalance === null) {
    return {
      kind: 'blocked',
      message: 'Refresh wallet LP balances before opening the vault execution review.',
      title: 'Wallet balance required',
    };
  }

  if (parsedAmount.kind === 'valid' && parsedAmount.amount > walletBalance) {
    const isWithdraw = withdrawContext !== undefined;
    return {
      kind: 'blocked',
      message: isWithdraw
        ? 'The connected wallet does not have enough PLP for this withdrawal.'
        : 'The connected wallet does not have enough DUSDC for this action.',
      recovery: isWithdraw
        ? 'Lower the PLP amount or refresh wallet PLP balance before withdrawing.'
        : 'Lower the DUSDC amount or refresh wallet DUSDC balance before supplying.',
      title: isWithdraw ? 'Insufficient wallet PLP' : 'Insufficient wallet DUSDC',
    };
  }

  if (withdrawContext !== undefined && withdrawContext?.availableWithdrawalQuote === 0n) {
    return {
      kind: 'blocked',
      message: 'Vault withdrawal is currently unavailable.',
      recovery:
        'Withdrawals depend on current vault value and max payout coverage. Try a smaller amount later.',
      title: 'Withdrawal unavailable',
    };
  }

  if (
    flowState.phase === 'building' ||
    flowState.phase === 'simulating' ||
    flowState.phase === 'signing'
  ) {
    return { kind: 'loading' };
  }

  if (flowState.phase === 'success') {
    return {
      ...(flowState.completedDigest === null ? {} : { digest: flowState.completedDigest }),
      kind: 'success',
    };
  }

  if (flowState.phase === 'failure' && flowState.error !== null) {
    return {
      kind: 'error',
      message: flowState.error.message,
      recovery: flowState.error.recovery,
      title: flowState.error.title,
    };
  }

  return { kind: 'ready' };
}

function VaultReadyStatus({ vault }: { vault: VaultModel }) {
  return (
    <InlineStateNotice className="border-[#a9d8c6]" label="Vault summary loaded" tone="success">
      Vault data ready from Predict server for {shortenObjectId(vault.predictId)}.
    </InlineStateNotice>
  );
}

function LoadingSummary() {
  return <StateSkeletonGrid className="md:grid-cols-4" count={4} label="Vault summary loading" />;
}

function ErrorNotice({ compact = false, error }: { compact?: boolean; error: PredictPilotError }) {
  return (
    <StatePanel
      className={compact ? 'mt-4' : ''}
      description={`${error.message} ${error.recovery}`}
      title={error.title}
      tone="error"
    />
  );
}

function MetricCard({
  compact = false,
  detail,
  label,
  value,
}: {
  compact?: boolean;
  detail?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`border border-[#d9dfdc] bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className={`${compact ? 'mt-1 text-base' : 'mt-2 text-xl'} font-semibold text-[#17211d]`}>
        {value}
      </p>
      {detail === undefined ? null : <p className="mt-2 text-sm text-[#4f625b]">{detail}</p>}
    </div>
  );
}

function ExposureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#64736e]">{label}</span>
      <span className="break-all text-right font-semibold text-[#17211d]">{value}</span>
    </div>
  );
}

type NetworkState =
  | {
      expectedNetwork: string;
      status: 'unknown';
    }
  | {
      currentNetwork: string;
      expectedNetwork: string;
      status: 'ready' | 'wrong-network';
    };

function getNetworkState(
  currentNetwork: string | null | undefined,
  expectedNetwork: string,
): NetworkState {
  if (currentNetwork === null || currentNetwork === undefined || currentNetwork.length === 0) {
    return {
      expectedNetwork,
      status: 'unknown',
    };
  }

  return {
    currentNetwork,
    expectedNetwork,
    status: currentNetwork === expectedNetwork ? 'ready' : 'wrong-network',
  };
}

function createEffectiveWalletStatus({
  networkState,
  sender,
  wallet,
}: {
  networkState: NetworkState;
  sender: SuiAddress | null;
  wallet: WalletStatusModel;
}): WalletStatusModel {
  const isConnected = sender !== null;
  const currentNetwork =
    networkState.status === 'unknown' ? wallet.currentNetwork : networkState.currentNetwork;
  const isExpectedNetwork = networkState.status === 'ready';

  return {
    ...wallet,
    accountAddress: sender,
    currentNetwork,
    expectedNetwork: networkState.expectedNetwork,
    isConnected,
    isDisconnected: !isConnected,
    isExpectedNetwork,
    isWrongNetwork: isConnected && !isExpectedNetwork,
    shortAddress: sender === null ? null : formatWalletAddress(sender),
    status: isConnected ? 'connected' : 'disconnected',
    statusLabel: isConnected ? 'Connected' : 'Disconnected',
  };
}

function NetworkBadge({ networkState }: { networkState: NetworkState }) {
  const label =
    networkState.status === 'unknown'
      ? `Expected ${networkState.expectedNetwork}`
      : networkState.status === 'ready'
        ? `Network ${networkState.currentNetwork}`
        : `Wrong network: ${networkState.currentNetwork}`;

  const className =
    networkState.status === 'wrong-network'
      ? 'border-[#e2b5b5] bg-[#fff7f7] text-[#7c2828]'
      : 'border-[#b8c6c0] bg-[#edf5f1] text-[#315447]';

  return (
    <span
      className={`w-fit border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

function parseDecimalAmount(value: string, decimals: number): ParsedAmount {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      amount: null,
      error: null,
      kind: 'empty',
    };
  }

  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    return {
      amount: null,
      error: 'Use a positive decimal number without symbols or commas.',
      kind: 'invalid',
    };
  }

  const [wholePart, fractionPart = ''] = trimmed.split('.');

  if (fractionPart.length > decimals) {
    return {
      amount: null,
      error: `Use at most ${decimals} decimal places.`,
      kind: 'invalid',
    };
  }

  const wholeAtomic = BigInt(wholePart) * 10n ** BigInt(decimals);
  const fractionAtomic = BigInt(fractionPart.padEnd(decimals, '0'));

  return {
    amount: wholeAtomic + fractionAtomic,
    error: null,
    kind: 'valid',
  };
}

function formatQuote(amount: bigint, symbol: string) {
  return `${formatAtomic(amount)} ${symbol}`;
}

function formatAtomic(amount: bigint) {
  return formatDecimalBigint(amount, predictDeploymentConfig.quoteDecimals);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 3 : 2)}%`;
}

function formatSharePrice(value: number) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
}

function formatTimestamp(timestampMs: bigint) {
  return new Date(Number(timestampMs)).toISOString();
}

function shortenObjectId(objectId: string) {
  return `${objectId.slice(0, 8)}...${objectId.slice(-6)}`;
}

function shortenMoveType(moveType: string) {
  const [packageId, moduleName, structName] = moveType.split('::');
  return `${shortenObjectId(packageId ?? moveType)}::${moduleName ?? '?'}::${structName ?? '?'}`;
}
