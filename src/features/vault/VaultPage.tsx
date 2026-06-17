import { useEffect, useMemo, useState } from 'react';
import { predictDeploymentConfig } from '@/config/predict';
import { useVaultPerformance } from '@/features/vault/hooks/useVaultPerformance';
import { useVaultSummary } from '@/features/vault/hooks/useVaultSummary';
import {
  prepareVaultSupply,
  prepareVaultWithdraw,
  type PreparedVaultSupply,
  type PreparedVaultWithdraw,
  type VaultLpSimulationOptions,
} from '@/features/vault/lib/vault-lp-prep';
import type { VaultReadClient } from '@/integrations/deepbook-predict/api/vault';
import { normalizeAppError, type PredictPilotError } from '@/lib/errors';
import { formatDecimalBigint } from '@/lib/formatters';
import type { QuoteAmount, SuiAddress } from '@/types/predict';
import type { VaultModel, VaultPerformanceModel, VaultPerformancePoint } from '@/types/vault';

export interface VaultPageProps {
  currentNetwork?: string | null;
  readClient?: VaultReadClient;
  sender?: SuiAddress | null;
  simulation?: VaultLpSimulationOptions;
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

interface KeyedPreparation<TPreparation> {
  key: string;
  result: TPreparation;
}

export function VaultPage({
  currentNetwork,
  readClient,
  sender = null,
  simulation,
  walletDusdcBalanceQuote = null,
  walletPlpBalanceAtomic = null,
}: VaultPageProps) {
  const [supplyAmountInput, setSupplyAmountInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [supplyPreparation, setSupplyPreparation] =
    useState<KeyedPreparation<PreparedVaultSupply> | null>(null);
  const [withdrawPreparation, setWithdrawPreparation] =
    useState<KeyedPreparation<PreparedVaultWithdraw> | null>(null);

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
  const networkState = getNetworkState(currentNetwork, expectedNetwork);
  const supplyAmount = useMemo(
    () => parseDecimalAmount(supplyAmountInput, predictDeploymentConfig.quoteDecimals),
    [supplyAmountInput],
  );
  const withdrawAmount = useMemo(
    () => parseDecimalAmount(withdrawAmountInput, predictDeploymentConfig.quoteDecimals),
    [withdrawAmountInput],
  );
  const supplyPreparationKey = useMemo(
    () =>
      createPreparationKey({
        amount: supplyAmount.kind === 'valid' ? supplyAmount.amount : null,
        networkState,
        sender,
        vault,
        walletBalance: walletDusdcBalanceQuote,
      }),
    [networkState, sender, supplyAmount, vault, walletDusdcBalanceQuote],
  );
  const withdrawPreparationKey = useMemo(
    () =>
      createPreparationKey({
        amount: withdrawAmount.kind === 'valid' ? withdrawAmount.amount : null,
        networkState,
        sender,
        vault,
        walletBalance: walletPlpBalanceAtomic,
      }),
    [networkState, sender, vault, walletPlpBalanceAtomic, withdrawAmount],
  );
  const activeSupplyPreparation =
    supplyPreparationKey !== null && supplyPreparation?.key === supplyPreparationKey
      ? supplyPreparation.result
      : null;
  const activeWithdrawPreparation =
    withdrawPreparationKey !== null && withdrawPreparation?.key === withdrawPreparationKey
      ? withdrawPreparation.result
      : null;

  useEffect(() => {
    let cancelled = false;

    if (supplyAmount.kind !== 'valid' || supplyPreparationKey === null) {
      return;
    }

    void prepareVaultSupply({
      amountQuote: supplyAmount.amount,
      sender,
      simulation,
      vault,
      walletDusdcBalanceQuote,
    })
      .then((preparation) => {
        if (!cancelled) {
          setSupplyPreparation({ key: supplyPreparationKey, result: preparation });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSupplyPreparation({
            key: supplyPreparationKey,
            result: {
              error: normalizeAppError(error, {
                context: {
                  action: 'SUPPLY',
                  service: 'VaultPage',
                },
              }),
              status: 'error',
              warnings: [],
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    networkState.status,
    sender,
    simulation,
    supplyAmount,
    supplyPreparationKey,
    vault,
    walletDusdcBalanceQuote,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (withdrawAmount.kind !== 'valid' || withdrawPreparationKey === null) {
      return;
    }

    void prepareVaultWithdraw({
      plpAmountAtomic: withdrawAmount.amount,
      sender,
      simulation,
      vault,
      walletPlpBalanceAtomic,
    })
      .then((preparation) => {
        if (!cancelled) {
          setWithdrawPreparation({ key: withdrawPreparationKey, result: preparation });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWithdrawPreparation({
            key: withdrawPreparationKey,
            result: {
              error: normalizeAppError(error, {
                context: {
                  action: 'WITHDRAW',
                  service: 'VaultPage',
                },
              }),
              status: 'error',
              warnings: [],
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    networkState.status,
    sender,
    simulation,
    vault,
    walletPlpBalanceAtomic,
    withdrawAmount,
    withdrawPreparationKey,
  ]);

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

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Vault LP preparation">
        <LpActionPanel
          amountInput={supplyAmountInput}
          amountLabel="Supply amount"
          amountPlaceholder="100.00"
          emptyWalletCopy="No DUSDC balance loaded for this wallet."
          inputError={supplyAmount.error}
          isPreparing={supplyPreparationKey !== null && activeSupplyPreparation === null}
          networkState={networkState}
          onAmountChange={setSupplyAmountInput}
          preparation={activeSupplyPreparation}
          quoteSymbol={quoteSymbol}
          sender={sender}
          title="Supply vault liquidity"
          vaultReadiness={vaultReadiness}
          walletBalance={walletDusdcBalanceQuote}
          walletBalanceLabel="Wallet DUSDC"
        />
        <LpActionPanel
          amountInput={withdrawAmountInput}
          amountLabel="Burn PLP amount"
          amountPlaceholder="50.00"
          emptyWalletCopy="No PLP position yet. Supply DUSDC to the vault to mint PLP shares."
          inputError={withdrawAmount.error}
          isPreparing={withdrawPreparationKey !== null && activeWithdrawPreparation === null}
          networkState={networkState}
          onAmountChange={setWithdrawAmountInput}
          preparation={activeWithdrawPreparation}
          quoteSymbol={quoteSymbol}
          sender={sender}
          title="Withdraw vault liquidity"
          vaultReadiness={vaultReadiness}
          walletBalance={walletPlpBalanceAtomic}
          walletBalanceLabel="Wallet PLP"
          withdrawContext={vault}
        />
      </section>
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
        <div aria-label="Vault performance loading" className="mt-4" role="status">
          <div className="h-40 animate-pulse bg-[#eef3f1]" />
          <p className="mt-3 text-sm text-[#64736e]">Loading vault performance...</p>
        </div>
      ) : null}

      {isError && error !== null ? <ErrorNotice error={error} compact /> : null}

      {!isLoading && !isError && points.length === 0 ? (
        <div className="mt-4 border border-dashed border-[#c8d3ce] bg-[#fbfcfc] p-4" role="status">
          <h3 className="font-semibold text-[#17211d]">No performance points yet</h3>
          <p className="mt-2 text-sm leading-6 text-[#4f625b]">
            The vault summary is available, but the performance series for this range is empty.
          </p>
        </div>
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
  const values = points.map((point) => Number(point.vaultValueQuote));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const latest = points[points.length - 1];

  return (
    <div className="mt-4">
      <div
        aria-label="Vault value performance chart"
        className="flex h-40 items-end gap-2 border border-[#edf1ef] bg-[#fbfcfc] p-3"
        role="img"
      >
        {points.map((point, index) => {
          const height = 24 + ((Number(point.vaultValueQuote) - min) / spread) * 112;
          return (
            <span
              className="min-w-3 flex-1 bg-[#2f7d62]"
              key={`${point.timestampMs.toString()}-${index}`}
              style={{ height }}
              title={`${formatQuote(point.vaultValueQuote, quoteSymbol)} at ${formatTimestamp(point.timestampMs)}`}
            />
          );
        })}
      </div>
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
  inputError,
  isPreparing,
  networkState,
  onAmountChange,
  preparation,
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
  inputError: string | null;
  isPreparing: boolean;
  networkState: NetworkState;
  onAmountChange: (value: string) => void;
  preparation: PreparedVaultSupply | PreparedVaultWithdraw | null;
  quoteSymbol: string;
  sender: SuiAddress | null;
  title: string;
  vaultReadiness: VaultReadiness;
  walletBalance: bigint | null;
  walletBalanceLabel: string;
  withdrawContext?: VaultModel | null;
}) {
  const isSupply = title.toLowerCase().startsWith('supply');
  const hasWalletBalance = walletBalance !== null && walletBalance !== undefined;
  const isZeroBalance = hasWalletBalance && walletBalance === 0n;
  const status = getPreparationStatus({
    amountInput,
    inputError,
    isPreparing,
    networkState,
    preparation,
    sender,
    vaultReadiness,
  });

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
          Preview only
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

        <PreparationStateView isSupply={isSupply} status={status} />

        <div className="border border-[#ead7a7] bg-[#fffaf0] p-3 text-sm leading-6 text-[#664b14]">
          {isSupply
            ? 'Exact PLP shares out require simulation or onchain confirmation.'
            : 'Exact DUSDC returned requires simulation or onchain confirmation.'}
        </div>

        {preparation !== null && preparation.status === 'ready' ? (
          <div className="grid gap-2 border border-[#c8d3ce] bg-[#f6faf8] p-3 text-sm text-[#315447]">
            <ExposureRow label="Prepared action" value={preparation.preview.action} />
            <ExposureRow label="Network" value={preparation.preview.expectedNetwork} />
            <ExposureRow
              label="Vault value snapshot"
              value={formatQuote(preparation.preview.vaultSnapshot.vaultValueQuote, quoteSymbol)}
            />
          </div>
        ) : null}

        {preparation !== null && preparation.status !== 'ready' ? (
          <ErrorNotice error={preparation.error} compact />
        ) : null}

        <button
          className="border border-[#b8c6c0] bg-[#eef3f1] px-3 py-2 text-sm font-semibold text-[#64736e]"
          disabled
          type="button"
        >
          {isSupply ? 'Supply signing not wired' : 'Withdraw signing not wired'}
        </button>
      </div>
    </section>
  );
}

function PreparationStateView({
  isSupply,
  status,
}: {
  isSupply: boolean;
  status: PreparationStatus;
}) {
  if (status.kind === 'idle') {
    return (
      <div
        className="border border-[#d9dfdc] bg-[#fbfcfc] p-3 text-sm text-[#4f625b]"
        role="status"
      >
        Enter an amount to prepare an unsigned {isSupply ? 'supply' : 'withdraw'} preview.
      </div>
    );
  }

  if (status.kind === 'loading') {
    return (
      <div
        aria-label={`${isSupply ? 'Supply' : 'Withdraw'} preparation loading`}
        className="border border-[#d9dfdc] bg-[#fbfcfc] p-3 text-sm text-[#4f625b]"
        role="status"
      >
        Preparing unsigned {isSupply ? 'supply' : 'withdraw'} preview...
      </div>
    );
  }

  if (status.kind === 'ready') {
    return (
      <div
        className="border border-[#a9d8c6] bg-[#f1fbf6] p-3 text-sm text-[#245942]"
        role="status"
      >
        {isSupply ? 'Supply preparation ready.' : 'Withdraw preparation ready.'} Review this preview
        before any future wallet signing flow.
      </div>
    );
  }

  return (
    <div
      className="border border-[#ead7a7] bg-[#fffaf0] p-3 text-sm leading-6 text-[#664b14]"
      role="alert"
    >
      <p className="font-semibold">{status.title}</p>
      <p className="mt-1">{status.message}</p>
    </div>
  );
}

type PreparationStatus =
  | {
      kind: 'blocked';
      message: string;
      title: string;
    }
  | {
      kind: 'error';
      message: string;
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
    };

type VaultReadiness = 'loading' | 'missing' | 'ready';

function getPreparationStatus({
  amountInput,
  inputError,
  isPreparing,
  networkState,
  preparation,
  sender,
  vaultReadiness,
}: {
  amountInput: string;
  inputError: string | null;
  isPreparing: boolean;
  networkState: NetworkState;
  preparation: PreparedVaultSupply | PreparedVaultWithdraw | null;
  sender: SuiAddress | null;
  vaultReadiness: VaultReadiness;
}): PreparationStatus {
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
      message: `Switch to ${networkState.expectedNetwork} before preparing vault LP actions.`,
      title: 'Wrong network',
    };
  }

  if (sender === null) {
    return {
      kind: 'blocked',
      message: 'Connect a Sui wallet on Testnet before preparing vault LP actions.',
      title: 'Wallet required',
    };
  }

  if (vaultReadiness === 'loading') {
    return { kind: 'loading' };
  }

  if (vaultReadiness === 'missing') {
    return {
      kind: 'blocked',
      message: 'Refresh the vault summary before preparing vault LP actions.',
      title: 'Vault state required',
    };
  }

  if (isPreparing) {
    return { kind: 'loading' };
  }

  if (preparation === null) {
    return { kind: 'loading' };
  }

  if (preparation.status === 'ready') {
    return { kind: 'ready' };
  }

  return {
    kind: preparation.status === 'error' ? 'error' : 'blocked',
    message: preparation.error.message,
    title: preparation.error.title,
  };
}

function VaultReadyStatus({ vault }: { vault: VaultModel }) {
  return (
    <div
      aria-label="Vault summary loaded"
      className="border border-[#a9d8c6] bg-[#f1fbf6] p-3 text-sm text-[#245942]"
      role="status"
    >
      Vault data ready from Predict server for {shortenObjectId(vault.predictId)}.
    </div>
  );
}

function LoadingSummary() {
  return (
    <section aria-label="Vault summary loading" className="grid gap-3 md:grid-cols-4" role="status">
      {[0, 1, 2, 3].map((item) => (
        <div className="h-24 animate-pulse border border-[#d9dfdc] bg-[#eef3f1]" key={item} />
      ))}
    </section>
  );
}

function ErrorNotice({ compact = false, error }: { compact?: boolean; error: PredictPilotError }) {
  return (
    <div
      className={`border border-[#e2b5b5] bg-[#fff7f7] text-[#7c2828] ${compact ? 'mt-4 p-3 text-sm' : 'p-4'}`}
      role="alert"
    >
      <h3 className="font-semibold">{error.title}</h3>
      <p className="mt-1 leading-6">{error.message}</p>
      <p className="mt-1 text-sm leading-6">{error.recovery}</p>
    </div>
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

function createPreparationKey({
  amount,
  networkState,
  sender,
  vault,
  walletBalance,
}: {
  amount: bigint | null;
  networkState: NetworkState;
  sender: SuiAddress | null;
  vault: VaultModel | null;
  walletBalance: bigint | null;
}) {
  if (
    amount === null ||
    networkState.status === 'wrong-network' ||
    sender === null ||
    vault === null
  ) {
    return null;
  }

  return [
    amount.toString(),
    networkState.status === 'ready' ? networkState.currentNetwork : 'unknown-network',
    sender,
    vault.predictId,
    vault.availableWithdrawalQuote.toString(),
    vault.availableLiquidityQuote.toString(),
    walletBalance === null ? 'wallet-balance-missing' : walletBalance.toString(),
  ].join('|');
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
