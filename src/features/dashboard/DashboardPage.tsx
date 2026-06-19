import { useMemo } from 'react';
import {
  InlineStateNotice,
  StatePanel,
  StateSkeletonGrid,
} from '@/components/states/StatePrimitives';
import {
  usePredictManager,
  type UsePredictManagerResult,
} from '@/features/manager/hooks/usePredictManager';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import { usePredictState } from '@/features/markets/hooks/usePredictState';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import { useVaultSummary } from '@/features/vault/hooks/useVaultSummary';
import { useWalletStatus, type WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import { formatDecimalBigint } from '@/lib/formatters';
import type { OracleSummaryModel } from '@/types/oracle';
import type { PredictStateModel, QuoteAmount, TimestampMs } from '@/types/predict';
import type { VaultModel } from '@/types/vault';
import type {
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
} from '@/features/portfolio/lib/portfolio-selectors';

type DashboardQueryStatus = 'empty' | 'error' | 'loading' | 'success';

export interface DashboardQuerySnapshot<TData> {
  data: TData | undefined;
  error: PredictPilotError | null;
  status: DashboardQueryStatus;
}

export interface DashboardViewModel {
  manager: UsePredictManagerResult;
  managerSummary: DashboardQuerySnapshot<ManagerSummaryPortfolioModel>;
  oracles: DashboardQuerySnapshot<OracleSummaryModel[]>;
  positions: DashboardQuerySnapshot<NormalizedManagerPositionsSummaryModel>;
  predictState: DashboardQuerySnapshot<PredictStateModel>;
  vault: DashboardQuerySnapshot<VaultModel>;
  wallet: WalletStatusModel;
}

interface MetricCardModel {
  label: string;
  state: 'blocked' | 'loading' | 'ready' | 'warning';
  value: string;
}

interface QuickStartStep {
  copy: string;
  label: string;
  state: 'blocked' | 'current' | 'later' | 'ready';
}

export function DashboardPage() {
  const wallet = useWalletStatus();
  const manager = usePredictManager();
  const predictState = usePredictState();
  const oracles = usePredictOracles();
  const vault = useVaultSummary();
  const resolvedManagerId =
    manager.isReady && manager.managerId !== null ? manager.managerId : undefined;
  const managerSummary = useManagerSummary({
    enabled: manager.isReady,
    managerId: resolvedManagerId,
  });
  const positions = usePositionsSummary({
    enabled: manager.isReady,
    managerId: resolvedManagerId,
  });

  const model = useMemo<DashboardViewModel>(
    () => ({
      manager,
      managerSummary: toQuerySnapshot(managerSummary),
      oracles: toQuerySnapshot(oracles),
      positions: toQuerySnapshot(positions),
      predictState: toQuerySnapshot(predictState),
      vault: toQuerySnapshot(vault),
      wallet,
    }),
    [manager, managerSummary, oracles, positions, predictState, vault, wallet],
  );

  return <DashboardView model={model} />;
}

export function DashboardView({ model }: { model: DashboardViewModel }) {
  const metrics = createMetricCards(model);
  const quickStart = createQuickStartSteps(model);
  const errors = collectDashboardErrors(model);
  const hasLoadingState = metrics.some((metric) => metric.state === 'loading');
  const oracleRows = createOracleRows(model.oracles.data ?? []);

  return (
    <section aria-labelledby="dashboard-title" className="space-y-5">
      <div className="border border-[#c8d3ce] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
          DeepBook Predict overview
        </p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1
              className="text-3xl font-semibold tracking-normal text-[#17211d]"
              id="dashboard-title"
            >
              Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615c]">
              Open a live OracleSVI market, preview risk, and keep every wallet action behind
              simulation and pre-sign review.
            </p>
          </div>
          <span className="w-fit border border-[#a8b7b0] bg-[#edf5f1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
            Sui Testnet read terminal
          </span>
        </div>
      </div>

      {hasLoadingState ? (
        <StatePanel
          description="Loading market status, manager readiness, and vault context from existing read hooks."
          label="Dashboard loading state"
          title="Loading dashboard"
          tone="loading"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {['Market status', 'Manager readiness', 'Vault snapshot'].map((label) => (
              <div className="border border-[#d9dfdc] bg-white p-3" key={label}>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64736e]">
                  {label}
                </p>
                <StateSkeletonGrid
                  className="mt-3 md:grid-cols-1"
                  count={1}
                  label={`${label} loading`}
                />
              </div>
            ))}
          </div>
        </StatePanel>
      ) : null}

      {errors.length > 0 ? (
        <div aria-label="Dashboard read errors" className="space-y-2">
          {errors.map((error) => (
            <ErrorPanel error={error.error} key={error.label} label={error.label} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)_minmax(260px,0.7fr)]">
        <Panel
          kicker="Opportunity Watchlist"
          title="Oracle markets"
          tone={model.oracles.status === 'error' ? 'warning' : 'default'}
        >
          {oracleRows.length === 0 ? (
            <EmptyState copy="No markets indexed yet. Retry the live read or open Demo Mode for the guided offline walkthrough." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#d9dfdc] text-xs uppercase tracking-[0.12em] text-[#64736e]">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Oracle / Expiry</th>
                    <th className="py-2 pr-3 font-semibold">State</th>
                    <th className="py-2 pr-3 font-semibold">Tick</th>
                    <th className="py-2 pr-3 font-semibold">Next</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ef]">
                  {oracleRows.map((row) => (
                    <tr key={row.oracleId}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#17211d]">{row.underlyingAsset}</p>
                        <p className="mt-1 text-xs text-[#64736e]">{row.expiryLabel}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill label={row.lifecycleStatus} />
                      </td>
                      <td className="py-3 pr-3 text-[#354842]">{row.tickLabel}</td>
                      <td className="py-3 pr-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#446b5e]">
                        Open in strategy later
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel kicker="Vault / PLP Snapshot" title="Shared liquidity">
          <dl className="grid gap-3">
            <DashboardDatum
              label="Vault value"
              value={
                model.vault.data === undefined
                  ? unavailableValue(model.vault.status)
                  : formatQuoteAmount(model.vault.data.vaultValueQuote)
              }
            />
            <DashboardDatum
              label="Available liquidity"
              value={
                model.vault.data === undefined
                  ? unavailableValue(model.vault.status)
                  : formatQuoteAmount(model.vault.data.availableLiquidityQuote)
              }
            />
            <DashboardDatum
              label="Available withdraw"
              value={
                model.vault.data === undefined
                  ? unavailableValue(model.vault.status)
                  : formatQuoteAmount(model.vault.data.availableWithdrawalQuote)
              }
            />
            <DashboardDatum
              label="PLP share price"
              value={
                model.vault.data === undefined
                  ? unavailableValue(model.vault.status)
                  : model.vault.data.plpSharePrice.toFixed(6)
              }
            />
          </dl>
        </Panel>

        <Panel kicker="Quick Start" title="Judge path">
          <ol className="space-y-3">
            {quickStart.map((step) => (
              <li
                className={`border px-3 py-3 ${quickStartClassName(step.state)}`}
                key={step.label}
              >
                <p className="text-sm font-semibold text-[#17211d]">{step.label}</p>
                <p className="mt-1 text-xs leading-5 text-[#52615c]">{step.copy}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel kicker="Oracle Freshness" title="Readiness strip">
          <dl className="grid gap-3 md:grid-cols-2">
            <DashboardDatum
              label="Active oracles"
              value={
                model.oracles.data === undefined
                  ? unavailableValue(model.oracles.status)
                  : countActiveOracles(model.oracles.data).toString()
              }
            />
            <DashboardDatum
              label="Blocked or settled"
              value={
                model.oracles.data === undefined
                  ? unavailableValue(model.oracles.status)
                  : countNonActiveOracles(model.oracles.data).toString()
              }
            />
            <DashboardDatum
              label="Freshness source"
              value="Oracle summaries loaded; focused live tape mounts on oracle pages"
            />
            <DashboardDatum
              label="Ask bounds"
              value="Shown per-market after strategy page selects an oracle"
            />
          </dl>
        </Panel>

        <Panel kicker="Portfolio Snapshot" title="Manager-centric state">
          <dl className="grid gap-3 md:grid-cols-2">
            <DashboardDatum label="Manager status" value={formatManagerStatus(model.manager)} />
            <DashboardDatum
              label="Manager balance"
              value={
                model.managerSummary.data === undefined
                  ? unavailableValue(model.managerSummary.status)
                  : formatQuoteAmount(model.managerSummary.data.balanceSummary.tradingBalanceQuote)
              }
            />
            <DashboardDatum
              label="Open binary"
              value={
                model.positions.data === undefined
                  ? unavailableValue(model.positions.status)
                  : model.positions.data.openBinaryPositionCount.toString()
              }
            />
            <DashboardDatum
              label="Open range"
              value={
                model.positions.data === undefined
                  ? unavailableValue(model.positions.status)
                  : model.positions.data.openRangePositionCount.toString()
              }
            />
          </dl>
          {model.positions.data?.isEmpty === true ? (
            <p className="mt-4 border border-[#d9dfdc] bg-[#fbfcfc] p-3 text-sm text-[#52615c]">
              No open positions yet. Mint a binary or range position after the preview and execution
              surfaces are mounted.
            </p>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}

function toQuerySnapshot<TData>({
  data,
  error,
  isError,
  isLoading,
  isPending,
  isSuccess,
}: {
  data: TData | undefined;
  error: PredictPilotError | null;
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
}): DashboardQuerySnapshot<TData> {
  if (isError) {
    return { data, error, status: 'error' };
  }

  if (isLoading || isPending) {
    return { data, error: null, status: 'loading' };
  }

  if (isSuccess && data !== undefined) {
    return { data, error: null, status: 'success' };
  }

  return { data, error: null, status: 'empty' };
}

function createMetricCards(model: DashboardViewModel): MetricCardModel[] {
  const activeOracles =
    model.oracles.data === undefined
      ? unavailableValue(model.oracles.status)
      : countActiveOracles(model.oracles.data).toString();
  const blockedOracles =
    model.oracles.data === undefined
      ? unavailableValue(model.oracles.status)
      : countNonActiveOracles(model.oracles.data).toString();

  return [
    {
      label: 'Live oracles',
      state: stateFromQuery(model.oracles.status),
      value: activeOracles,
    },
    {
      label: 'Manager ready',
      state: model.manager.isReady ? 'ready' : 'blocked',
      value: formatManagerStatus(model.manager),
    },
    {
      label: 'Manager dUSDC',
      state: stateFromQuery(model.managerSummary.status),
      value:
        model.managerSummary.data === undefined
          ? unavailableValue(model.managerSummary.status)
          : formatQuoteAmount(model.managerSummary.data.balanceSummary.tradingBalanceQuote),
    },
    {
      label: 'Open positions',
      state: stateFromQuery(model.positions.status),
      value:
        model.positions.data === undefined
          ? unavailableValue(model.positions.status)
          : (
              model.positions.data.openBinaryPositionCount +
              model.positions.data.openRangePositionCount
            ).toString(),
    },
    {
      label: 'Vault utilization',
      state: stateFromQuery(model.vault.status),
      value:
        model.vault.data === undefined
          ? unavailableValue(model.vault.status)
          : formatPercent(model.vault.data.utilizationRatio),
    },
    {
      label: 'Oracle alerts',
      state: blockedOracles === '0' ? 'ready' : 'warning',
      value: blockedOracles,
    },
  ];
}

function createQuickStartSteps(model: DashboardViewModel): QuickStartStep[] {
  const currentStep = getCurrentQuickStartStep(model);

  return [
    {
      copy: 'Connect a Sui wallet through the existing dApp Kit provider.',
      label: 'Connect Wallet',
      state:
        currentStep === 'Connect Wallet'
          ? 'current'
          : model.wallet.isConnected
            ? 'ready'
            : 'blocked',
    },
    {
      copy: 'Use one PredictManager per wallet before deposits or trades.',
      label: 'Create PredictManager',
      state:
        currentStep === 'Create PredictManager'
          ? 'current'
          : model.manager.isReady
            ? 'ready'
            : 'later',
    },
    {
      copy: 'Fund manager dUSDC before minting binary or range positions.',
      label: 'Deposit dUSDC',
      state:
        currentStep === 'Deposit dUSDC'
          ? 'current'
          : model.managerSummary.data !== undefined &&
              model.managerSummary.data.balanceSummary.tradingBalanceQuote > 0n
            ? 'ready'
            : 'later',
    },
    {
      copy: 'Open a market detail page to stage a strategy; this dashboard never signs directly.',
      label: 'Build Trade',
      state: currentStep === 'Build Trade' ? 'current' : 'later',
    },
  ];
}

function getCurrentQuickStartStep(model: DashboardViewModel) {
  if (!model.wallet.isConnected) {
    return 'Connect Wallet';
  }

  if (model.wallet.isWrongNetwork) {
    return 'Connect Wallet';
  }

  if (model.manager.requiresCreateManager || model.manager.status === 'NO_MANAGER') {
    return 'Create PredictManager';
  }

  if (
    model.manager.isReady &&
    (model.managerSummary.data === undefined ||
      model.managerSummary.data.balanceSummary.tradingBalanceQuote === 0n)
  ) {
    return 'Deposit dUSDC';
  }

  return 'Build Trade';
}

function collectDashboardErrors(model: DashboardViewModel) {
  return [
    { error: model.predictState.error, label: 'Predict state' },
    { error: model.oracles.error, label: 'Oracle list' },
    { error: model.vault.error, label: 'Vault summary' },
    { error: model.manager.error, label: 'PredictManager discovery' },
    { error: model.managerSummary.error, label: 'Manager summary' },
    { error: model.positions.error, label: 'Positions summary' },
  ].filter((item): item is { error: PredictPilotError; label: string } => item.error !== null);
}

function createOracleRows(oracles: OracleSummaryModel[]) {
  return [...oracles]
    .sort(compareOracleRows)
    .slice(0, 5)
    .map((oracle) => ({
      expiryLabel: formatTimestamp(oracle.expiryMs),
      lifecycleStatus: oracle.lifecycleStatus,
      oracleId: oracle.oracleId,
      tickLabel: formatScaledPrice(oracle.tickSize1e9),
      underlyingAsset: oracle.underlyingAsset,
    }));
}

function compareOracleRows(left: OracleSummaryModel, right: OracleSummaryModel): number {
  if (left.lifecycleStatus === 'ACTIVE' && right.lifecycleStatus !== 'ACTIVE') {
    return -1;
  }

  if (left.lifecycleStatus !== 'ACTIVE' && right.lifecycleStatus === 'ACTIVE') {
    return 1;
  }

  return compareBigint(left.expiryMs, right.expiryMs);
}

function countActiveOracles(oracles: OracleSummaryModel[]) {
  return oracles.filter((oracle) => oracle.lifecycleStatus === 'ACTIVE').length;
}

function countNonActiveOracles(oracles: OracleSummaryModel[]) {
  return oracles.filter((oracle) => oracle.lifecycleStatus !== 'ACTIVE').length;
}

function stateFromQuery(status: DashboardQueryStatus): MetricCardModel['state'] {
  switch (status) {
    case 'empty':
      return 'blocked';
    case 'error':
      return 'warning';
    case 'loading':
      return 'loading';
    case 'success':
      return 'ready';
  }
}

function unavailableValue(status: DashboardQueryStatus) {
  switch (status) {
    case 'empty':
      return 'Unavailable';
    case 'error':
      return 'Error';
    case 'loading':
      return 'Loading';
    case 'success':
      return 'Unavailable';
  }
}

function formatManagerStatus(manager: UsePredictManagerResult) {
  switch (manager.status) {
    case 'AMBIGUOUS':
      return 'Ambiguous';
    case 'CONFIRMING':
      return 'Confirming';
    case 'ERROR':
      return 'Error';
    case 'LOADING':
      return 'Loading';
    case 'NO_MANAGER':
      return 'Create needed';
    case 'NO_WALLET':
      return 'No wallet';
    case 'READY':
      return 'Ready';
  }
}

function formatQuoteAmount(value: QuoteAmount) {
  return `${formatDecimalBigint(value, 6)} dUSDC`;
}

function formatScaledPrice(value: bigint) {
  return formatDecimalBigint(value, 9);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatTimestamp(value: TimestampMs) {
  const timestamp = Number(value);

  if (!Number.isSafeInteger(timestamp)) {
    return value.toString();
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}

function compareBigint(left: bigint, right: bigint) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function MetricCard({ metric }: { metric: MetricCardModel }) {
  return (
    <article className={`border p-4 ${metricCardClassName(metric.state)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#52615c]">
        {metric.label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[#17211d]">{metric.value}</p>
    </article>
  );
}

function Panel({
  children,
  kicker,
  title,
  tone = 'default',
}: {
  children: React.ReactNode;
  kicker: string;
  title: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <section
      className={`border p-4 shadow-sm ${tone === 'warning' ? 'border-[#dfc170] bg-[#fff9ea]' : 'border-[#c8d3ce] bg-white'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52615c]">{kicker}</p>
      <h2 className="mt-2 text-lg font-semibold text-[#17211d]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DashboardDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[#17211d]">{value}</dd>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex border border-[#b8c6c0] bg-[#edf5f1] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315447]">
      {label}
    </span>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return <InlineStateNotice tone="empty">{copy}</InlineStateNotice>;
}

function ErrorPanel({ error, label }: { error: PredictPilotError; label: string }) {
  return (
    <StatePanel
      description={error.message}
      label={`${label} error`}
      title={`${label}: ${error.title}`}
      tone="error"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.1em]">{error.recovery}</p>
    </StatePanel>
  );
}

function metricCardClassName(state: MetricCardModel['state']) {
  switch (state) {
    case 'blocked':
      return 'border-[#d9dfdc] bg-[#fbfcfc]';
    case 'loading':
      return 'border-[#d9dfdc] bg-[#f7faf9]';
    case 'ready':
      return 'border-[#a8b7b0] bg-[#edf5f1]';
    case 'warning':
      return 'border-[#dfc170] bg-[#fff9ea]';
  }
}

function quickStartClassName(state: QuickStartStep['state']) {
  switch (state) {
    case 'blocked':
      return 'border-[#d9dfdc] bg-[#fbfcfc]';
    case 'current':
      return 'border-[#719485] bg-[#edf5f1]';
    case 'later':
      return 'border-[#d9dfdc] bg-white';
    case 'ready':
      return 'border-[#a8b7b0] bg-[#f7fbf9]';
  }
}
