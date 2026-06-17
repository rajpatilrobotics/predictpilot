import { useMemo, useState } from 'react';
import { predictDeploymentConfig } from '@/config/predict';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { usePredictOracles } from '@/features/markets/hooks/usePredictOracles';
import { usePredictState } from '@/features/markets/hooks/usePredictState';
import { useLiveOracleTape } from '@/features/oracle/hooks/useLiveOracleTape';
import { getOracleStatus, type OracleActionAvailability } from '@/lib/oracle-status';
import type {
  OracleAskBoundsModel,
  OracleLifecycleStatus,
  OracleStateModel,
  OracleSummaryModel,
} from '@/types/oracle';
import type { ObjectId, PredictStateModel, TimestampMs } from '@/types/predict';

type LifecycleFilter = OracleLifecycleStatus | 'ALL';

interface MarketIntelligencePageProps {
  nowMs?: number;
}

const lifecycleOptions: LifecycleFilter[] = [
  'ALL',
  'ACTIVE',
  'PENDING_SETTLEMENT',
  'SETTLED',
  'INACTIVE',
];

const fallbackOracleId = predictDeploymentConfig.predictObjectId;

export function MarketIntelligencePage({ nowMs }: MarketIntelligencePageProps) {
  const [copiedOracleId, setCopiedOracleId] = useState<ObjectId | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('ALL');
  const [mountedAtMs] = useState(() => Date.now());
  const [selectedOracleId, setSelectedOracleId] = useState<ObjectId | null>(
    predictDeploymentConfig.defaultOracleId ?? null,
  );
  const [underlyingFilter, setUnderlyingFilter] = useState('ALL');
  const renderNowMs = nowMs ?? mountedAtMs;

  const predictStateQuery = usePredictState();
  const oraclesQuery = usePredictOracles({
    predictId: predictDeploymentConfig.predictObjectId,
  });

  const oracles = useMemo(() => oraclesQuery.data ?? [], [oraclesQuery.data]);
  const underlyingOptions = useMemo(() => getUnderlyingOptions(oracles), [oracles]);
  const filteredOracles = useMemo(
    () =>
      sortOracleSummaries(
        oracles.filter((oracle) => {
          const matchesUnderlying =
            underlyingFilter === 'ALL' || oracle.underlyingAsset === underlyingFilter;
          const matchesLifecycle =
            lifecycleFilter === 'ALL' || oracle.lifecycleStatus === lifecycleFilter;

          return matchesUnderlying && matchesLifecycle;
        }),
      ),
    [lifecycleFilter, oracles, underlyingFilter],
  );
  const selectedOracle = useMemo(
    () =>
      filteredOracles.find((oracle) => oracle.oracleId === selectedOracleId) ?? filteredOracles[0],
    [filteredOracles, selectedOracleId],
  );
  const selectedOracleQueryId = selectedOracle?.oracleId ?? fallbackOracleId;
  const hasSelectedOracle = selectedOracle !== undefined;

  const oracleStateQuery = useOracleState({
    enabled: hasSelectedOracle,
    oracleId: selectedOracleQueryId,
  });
  const askBoundsQuery = useAskBounds({
    enabled: hasSelectedOracle,
    oracleId: selectedOracleQueryId,
  });
  const liveTape = useLiveOracleTape({
    enabled: hasSelectedOracle,
    oracleId: selectedOracleQueryId,
  });

  const selectedOracleState = oracleStateQuery.data;
  const askBounds = askBoundsQuery.data ?? selectedOracleState?.askBounds;
  const initialLoadPending =
    isQueryPending(predictStateQuery) || (isQueryPending(oraclesQuery) && oracles.length === 0);
  const blockingError = predictStateQuery.error ?? oraclesQuery.error;

  function selectOracle(oracleId: ObjectId) {
    setSelectedOracleId(oracleId);
    setCopiedOracleId(null);
  }

  function copySelectedOracleId() {
    if (selectedOracle === undefined) {
      return;
    }

    setCopiedOracleId(selectedOracle.oracleId);
    void navigator.clipboard?.writeText(selectedOracle.oracleId);
  }

  return (
    <article aria-labelledby="market-intelligence-title" className="space-y-5">
      <header className="border border-[#c8d3ce] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PP-042 Market Intelligence
            </p>
            <h1
              className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]"
              id="market-intelligence-title"
            >
              Market Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#52615c]">
              Compare DeepBook Predict oracles by lifecycle, expiry, freshness, and ask-bounds
              availability. This lane is read-only and does not stage strategy or execution.
            </p>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 xl:min-w-[360px]">
            <ContextPill
              label="Predict object"
              value={shortId(predictDeploymentConfig.predictObjectId)}
            />
            <ContextPill label="Quote" value={predictDeploymentConfig.quoteAsset.symbol} />
            <ContextPill label="Network" value={`Sui ${predictDeploymentConfig.network}`} />
            <ContextPill label="Source" value="Indexed + focused polling" />
          </div>
        </div>
      </header>

      {initialLoadPending ? <MarketsLoadingState /> : null}

      {blockingError === null || blockingError === undefined ? null : (
        <MarketsErrorState message={getErrorMessage(blockingError)} />
      )}

      {!initialLoadPending && blockingError === null && oracles.length === 0 ? (
        <MarketsEmptyState />
      ) : null}

      {!initialLoadPending && blockingError === null && oracles.length > 0 ? (
        <>
          <PredictStatePanel predictState={predictStateQuery.data} />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)]">
            <div className="space-y-4">
              <MarketFilters
                lifecycleFilter={lifecycleFilter}
                lifecycleOptions={lifecycleOptions}
                onLifecycleChange={setLifecycleFilter}
                onUnderlyingChange={setUnderlyingFilter}
                underlyingFilter={underlyingFilter}
                underlyingOptions={underlyingOptions}
              />
              <OracleList
                filteredCount={filteredOracles.length}
                nowMs={renderNowMs}
                onSelect={selectOracle}
                oracles={filteredOracles}
                selectedOracleId={selectedOracle?.oracleId ?? null}
                totalCount={oracles.length}
              />
            </div>

            <SelectedMarketPanel
              askBounds={askBounds}
              askBoundsError={askBoundsQuery.error}
              copiedOracleId={copiedOracleId}
              isAskBoundsPending={isQueryPending(askBoundsQuery)}
              isLiveTapePending={liveTape.isPending || liveTape.isLoading}
              isOracleStatePending={isQueryPending(oracleStateQuery)}
              liveTape={liveTape.data}
              liveTapeError={liveTape.error}
              nowMs={renderNowMs}
              onCopyOracleId={copySelectedOracleId}
              oracle={selectedOracle}
              oracleState={selectedOracleState}
              oracleStateError={oracleStateQuery.error}
            />
          </section>
        </>
      ) : null}
    </article>
  );
}

function PredictStatePanel({ predictState }: { predictState: PredictStateModel | undefined }) {
  const quoteAssetSupported =
    predictState?.quoteAssets.includes(predictDeploymentConfig.quoteAssetType) ?? false;

  return (
    <section
      aria-label="Predict market context"
      className="grid gap-3 border border-[#c8d3ce] bg-white p-4 text-sm shadow-sm md:grid-cols-4"
    >
      <MetricCard
        label="Quote asset"
        tone={quoteAssetSupported ? 'success' : 'warning'}
        value={quoteAssetSupported ? 'DUSDC supported' : 'TODO VERIFY quote support'}
      />
      <MetricCard
        label="Trading pause"
        tone={predictState?.tradingPaused === true ? 'warning' : 'success'}
        value={predictState?.tradingPaused === true ? 'Paused' : 'Not paused'}
      />
      <MetricCard
        label="Pricing payload"
        tone={predictState?.pricingStatus === 'PRESENT' ? 'success' : 'warning'}
        value={predictState?.pricingStatus === 'PRESENT' ? 'Present' : 'TODO VERIFY missing'}
      />
      <MetricCard
        label="Risk payload"
        tone={predictState?.riskStatus === 'PRESENT' ? 'success' : 'warning'}
        value={predictState?.riskStatus === 'PRESENT' ? 'Present' : 'TODO VERIFY missing'}
      />
    </section>
  );
}

function MarketFilters({
  lifecycleFilter,
  lifecycleOptions,
  onLifecycleChange,
  onUnderlyingChange,
  underlyingFilter,
  underlyingOptions,
}: {
  lifecycleFilter: LifecycleFilter;
  lifecycleOptions: LifecycleFilter[];
  onLifecycleChange: (value: LifecycleFilter) => void;
  onUnderlyingChange: (value: string) => void;
  underlyingFilter: string;
  underlyingOptions: string[];
}) {
  return (
    <section
      aria-label="Market filters"
      className="grid gap-3 border border-[#c8d3ce] bg-white p-4 text-sm shadow-sm md:grid-cols-2"
    >
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Underlying
        </span>
        <select
          className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-medium text-[#17211d]"
          onChange={(event) => onUnderlyingChange(event.target.value)}
          value={underlyingFilter}
        >
          <option value="ALL">All assets</option>
          {underlyingOptions.map((underlying) => (
            <option key={underlying} value={underlying}>
              {underlying}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
          Lifecycle
        </span>
        <select
          className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 font-medium text-[#17211d]"
          onChange={(event) => onLifecycleChange(event.target.value as LifecycleFilter)}
          value={lifecycleFilter}
        >
          {lifecycleOptions.map((status) => (
            <option key={status} value={status}>
              {formatLifecycle(status)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function OracleList({
  filteredCount,
  nowMs,
  onSelect,
  oracles,
  selectedOracleId,
  totalCount,
}: {
  filteredCount: number;
  nowMs: number;
  onSelect: (oracleId: ObjectId) => void;
  oracles: OracleSummaryModel[];
  selectedOracleId: ObjectId | null;
  totalCount: number;
}) {
  if (oracles.length === 0) {
    return (
      <section
        aria-label="Oracle list"
        className="border border-[#d9c27d] bg-[#fff9ea] p-5 text-sm text-[#5c4720]"
      >
        <h2 className="text-lg font-semibold text-[#3f3014]">No markets match these filters</h2>
        <p className="mt-2 leading-6">
          Clear one local filter to return to the loaded oracle set. No new server request or
          endpoint is needed for this filter state.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Oracle list" className="border border-[#c8d3ce] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#d9dfdc] p-4">
        <div>
          <h2 className="text-lg font-semibold text-[#17211d]">Oracle markets</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#64736e]">
            Showing {filteredCount} of {totalCount}
          </p>
        </div>
        <span className="border border-[#b8c6c0] bg-[#edf5f1] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#315447]">
          Local filters
        </span>
      </div>

      <div className="divide-y divide-[#e6ebe8]">
        {oracles.map((oracle) => {
          const isSelected = selectedOracleId === oracle.oracleId;
          const isPotentiallyTradeable =
            oracle.lifecycleStatus === 'ACTIVE' && oracle.expiryMs > BigInt(nowMs);

          return (
            <button
              aria-pressed={isSelected}
              className={`grid w-full gap-3 p-4 text-left transition hover:bg-[#f8fbfa] ${
                isSelected ? 'bg-[#edf5f1]' : 'bg-white'
              }`}
              key={oracle.oracleId}
              onClick={() => onSelect(oracle.oracleId)}
              type="button"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#17211d]">{oracle.underlyingAsset} Oracle</h3>
                  <p className="mt-1 font-mono text-xs text-[#64736e]">
                    {shortId(oracle.oracleId)}
                  </p>
                </div>
                <LifecycleBadge status={oracle.lifecycleStatus} />
              </div>
              <dl className="grid gap-3 text-xs sm:grid-cols-3">
                <CompactDatum label="Expiry" value={formatTimestamp(oracle.expiryMs)} />
                <CompactDatum label="Min strike" value={formatPrice1e9(oracle.minStrike1e9)} />
                <CompactDatum
                  label="Tradeability"
                  value={isPotentiallyTradeable ? 'Potentially live' : 'Inspect state'}
                />
              </dl>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedMarketPanel({
  askBounds,
  askBoundsError,
  copiedOracleId,
  isAskBoundsPending,
  isLiveTapePending,
  isOracleStatePending,
  liveTape,
  liveTapeError,
  nowMs,
  onCopyOracleId,
  oracle,
  oracleState,
  oracleStateError,
}: {
  askBounds: OracleAskBoundsModel | undefined;
  askBoundsError: unknown;
  copiedOracleId: ObjectId | null;
  isAskBoundsPending: boolean;
  isLiveTapePending: boolean;
  isOracleStatePending: boolean;
  liveTape: ReturnType<typeof useLiveOracleTape>['data'];
  liveTapeError: unknown;
  nowMs: number;
  onCopyOracleId: () => void;
  oracle: OracleSummaryModel | undefined;
  oracleState: OracleStateModel | undefined;
  oracleStateError: unknown;
}) {
  if (oracle === undefined) {
    return (
      <section
        aria-label="Selected market"
        className="border border-[#d9c27d] bg-[#fff9ea] p-5 text-sm text-[#5c4720]"
      >
        <h2 className="text-lg font-semibold text-[#3f3014]">No selected market</h2>
        <p className="mt-2 leading-6">Load or clear filters to select a market for inspection.</p>
      </section>
    );
  }

  const status = oracleState === undefined ? null : getOracleStatus({ nowMs, oracleState });
  const latestPrice = oracleState?.latestPrice ?? null;
  const latestSvi = oracleState?.latestSvi ?? null;
  const effectiveAskBounds = askBounds ?? oracleState?.askBounds;
  const selectedCopied = copiedOracleId === oracle.oracleId;

  return (
    <section aria-label="Selected market" className="border border-[#c8d3ce] bg-white shadow-sm">
      <div className="border-b border-[#d9dfdc] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52615c]">
              Selected market context
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#17211d]">
              {oracle.underlyingAsset} / {formatTimestamp(oracle.expiryMs)}
            </h2>
            <p className="mt-2 font-mono text-xs text-[#64736e]">{oracle.oracleId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="border border-[#6c8f82] bg-[#edf5f1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#244a3c]"
              href={`/markets/${oracle.oracleId}`}
            >
              View Oracle
            </a>
            <button
              className="border border-[#b8c6c0] bg-[#fbfcfc] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#315447]"
              onClick={onCopyOracleId}
              type="button"
            >
              {selectedCopied ? 'Oracle copied' : 'Copy Oracle ID'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        {oracleStateError === null || oracleStateError === undefined ? null : (
          <InlineWarning
            title="Selected oracle state failed"
            value={getErrorMessage(oracleStateError)}
          />
        )}
        {askBoundsError === null || askBoundsError === undefined ? null : (
          <InlineWarning title="Ask bounds failed" value={getErrorMessage(askBoundsError)} />
        )}
        {liveTapeError === null || liveTapeError === undefined ? null : (
          <InlineWarning title="Live oracle tape failed" value={getErrorMessage(liveTapeError)} />
        )}

        {isOracleStatePending ? (
          <InlineInfo value="Loading selected oracle state from the existing oracle hook." />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Lifecycle"
            tone={getLifecycleTone(oracle.lifecycleStatus)}
            value={formatLifecycle(oracle.lifecycleStatus)}
          />
          <MetricCard
            label="Expiry"
            tone={oracle.expiryMs > BigInt(nowMs) ? 'success' : 'warning'}
            value={formatRelativeExpiry(oracle.expiryMs, nowMs)}
          />
          <MetricCard
            label="Freshness"
            tone={status === null ? 'neutral' : status.freshness.aggregateSeverity}
            value={status === null ? 'Loading' : formatFreshness(status.freshness.aggregateStatus)}
          />
          <MetricCard
            label="Ask bounds"
            tone={getAskBoundsTone(effectiveAskBounds)}
            value={isAskBoundsPending ? 'Loading' : formatAskBounds(effectiveAskBounds)}
          />
          <MetricCard
            label="Binary mint"
            tone={status === null ? 'neutral' : status.mint.severity}
            value={status === null ? 'Loading' : formatAvailability(status.mint)}
          />
          <MetricCard
            label="Range mint"
            tone={status === null ? 'neutral' : status.mintRange.severity}
            value={status === null ? 'Loading' : formatAvailability(status.mintRange)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ProtocolPanel
            rows={[
              [
                'Spot',
                latestPrice === null
                  ? 'TODO VERIFY latest price missing'
                  : formatPrice1e9(latestPrice.spot1e9),
              ],
              [
                'Forward',
                latestPrice === null
                  ? 'TODO VERIFY latest price missing'
                  : formatPrice1e9(latestPrice.forward1e9),
              ],
              [
                'Price timestamp',
                latestPrice === null ? 'Unknown' : formatTimestamp(latestPrice.onchainTimestampMs),
              ],
              [
                'SVI timestamp',
                latestSvi === null ? 'Unknown' : formatTimestamp(latestSvi.onchainTimestampMs),
              ],
            ]}
            title="Oracle pricing"
          />
          <ProtocolPanel
            rows={[
              ['Min strike', formatPrice1e9(oracle.minStrike1e9)],
              ['Tick size', formatPrice1e9(oracle.tickSize1e9)],
              [
                'Settlement',
                oracle.settlementPrice1e9 === null
                  ? 'Not settled'
                  : formatPrice1e9(oracle.settlementPrice1e9),
              ],
              ['Market detail path', `/markets/${oracle.oracleId}`],
            ]}
            title="Selection context"
          />
        </div>

        <LiveTapePanel isPending={isLiveTapePending} liveTape={liveTape} />
      </div>
    </section>
  );
}

function LiveTapePanel({
  isPending,
  liveTape,
}: {
  isPending: boolean;
  liveTape: ReturnType<typeof useLiveOracleTape>['data'];
}) {
  if (isPending && liveTape === undefined) {
    return (
      <InlineInfo value="Starting focused live oracle tape polling for the selected market." />
    );
  }

  if (liveTape === undefined) {
    return (
      <InlineWarning
        title="TODO VERIFY live oracle tape"
        value="No focused tape payload is available yet; the page keeps server-rendered state visible."
      />
    );
  }

  return (
    <section aria-label="Live oracle tape" className="border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-[#17211d]">Live oracle tape</h3>
          <p className="mt-1 text-sm leading-6 text-[#52615c]">
            Focused polling uses the existing live oracle hook; no new stream or endpoint is added.
          </p>
        </div>
        <span className="w-fit border border-[#b8c6c0] bg-white px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#52615c]">
          {liveTape.source}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
        <CompactDatum label="Updates" value={liveTape.updateCount.toString()} />
        <CompactDatum label="Poll interval" value={`${liveTape.pollIntervalMs} ms`} />
        <CompactDatum label="Last poll" value={formatTimestamp(liveTape.lastPollAtMs)} />
        <CompactDatum label="Lifecycle" value={formatLifecycle(liveTape.lifecycleStatus)} />
      </dl>
    </section>
  );
}

function MarketsLoadingState() {
  return (
    <section
      aria-label="Market intelligence loading state"
      className="border border-[#c8d3ce] bg-white p-5 text-sm text-[#52615c]"
      role="status"
    >
      <p className="font-semibold text-[#17211d]">Loading market intelligence</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <span className="h-16 bg-[#e8eeee]" />
        <span className="h-16 bg-[#e8eeee]" />
        <span className="h-16 bg-[#e8eeee]" />
      </div>
    </section>
  );
}

function MarketsEmptyState() {
  return (
    <section
      aria-label="Market intelligence empty state"
      className="border border-[#d9c27d] bg-[#fff9ea] p-5 text-sm text-[#5c4720]"
    >
      <h2 className="text-lg font-semibold text-[#3f3014]">No Predict oracles loaded</h2>
      <p className="mt-2 leading-6">
        The existing oracle list hook returned no markets. Retry the Predict server before staging
        market detail or execution work.
      </p>
    </section>
  );
}

function MarketsErrorState({ message }: { message: string }) {
  return (
    <section
      aria-label="Market intelligence error state"
      className="border border-[#d6a38f] bg-[#fff8f4] p-5 text-sm text-[#563023]"
      role="alert"
    >
      <h2 className="text-lg font-semibold text-[#3c1f16]">Market intelligence failed to load</h2>
      <p className="mt-2 leading-6">{message}</p>
    </section>
  );
}

function ProtocolPanel({ rows, title }: { rows: Array<[string, string]>; title: string }) {
  return (
    <section className="border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <h3 className="font-semibold text-[#17211d]">{title}</h3>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <CompactDatum key={label} label={label} value={value} />
        ))}
      </dl>
    </section>
  );
}

function MetricCard({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
  value: string;
}) {
  return (
    <div className={`border p-3 ${getToneClasses(tone)}`}>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] opacity-75">{label}</dt>
      <dd className="mt-2 font-semibold">{value}</dd>
    </div>
  );
}

function ContextPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}

function CompactDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}

function InlineInfo({ value }: { value: string }) {
  return (
    <p className="border border-[#b8c6c0] bg-[#edf5f1] p-3 text-sm leading-6 text-[#315447]">
      {value}
    </p>
  );
}

function InlineWarning({ title, value }: { title?: string; value: string }) {
  return (
    <div className="border border-[#d9c27d] bg-[#fff9ea] p-3 text-sm leading-6 text-[#5c4720]">
      {title === undefined ? null : <p className="font-semibold text-[#3f3014]">{title}</p>}
      <p>{value}</p>
    </div>
  );
}

function LifecycleBadge({ status }: { status: OracleLifecycleStatus }) {
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${getLifecycleBadgeClasses(status)}`}
    >
      {formatLifecycle(status)}
    </span>
  );
}

function sortOracleSummaries(oracles: OracleSummaryModel[]) {
  return [...oracles].sort((left, right) => {
    const leftRank = left.lifecycleStatus === 'ACTIVE' ? 0 : 1;
    const rightRank = right.lifecycleStatus === 'ACTIVE' ? 0 : 1;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.expiryMs !== right.expiryMs) {
      return left.expiryMs < right.expiryMs ? -1 : 1;
    }

    return left.underlyingAsset.localeCompare(right.underlyingAsset);
  });
}

function getUnderlyingOptions(oracles: OracleSummaryModel[]) {
  return [...new Set(oracles.map((oracle) => oracle.underlyingAsset))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function isQueryPending(query: { isLoading?: boolean; isPending?: boolean }) {
  return Boolean(query.isLoading || query.isPending);
}

function formatLifecycle(status: LifecycleFilter) {
  if (status === 'ALL') {
    return 'All lifecycle states';
  }

  return status
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatAskBounds(askBounds: OracleAskBoundsModel | undefined) {
  if (askBounds === undefined) {
    return 'Loading';
  }

  if (askBounds.status === 'UNAVAILABLE') {
    return 'Unavailable';
  }

  return 'TODO VERIFY numeric bounds unmapped';
}

function formatAvailability(availability: OracleActionAvailability) {
  if (availability.status === 'AVAILABLE') {
    return 'Available';
  }

  if (availability.status === 'WARNING') {
    return 'Needs refresh';
  }

  return 'Blocked';
}

function formatFreshness(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPrice1e9(value: bigint) {
  const asNumber = Number(value) / 1_000_000_000;

  if (!Number.isFinite(asNumber)) {
    return `${value.toString()} / 1e9`;
  }

  return asNumber.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatRelativeExpiry(expiryMs: TimestampMs, nowMs: number) {
  const deltaMs = expiryMs - BigInt(nowMs);
  const absoluteMs = deltaMs < 0n ? -deltaMs : deltaMs;
  const minutes = absoluteMs / 60_000n;

  if (deltaMs < 0n) {
    return `Expired ${minutes.toString()}m ago`;
  }

  return `Expires in ${minutes.toString()}m`;
}

function formatTimestamp(timestampMs: TimestampMs) {
  const timestampNumber = Number(timestampMs);

  if (!Number.isSafeInteger(timestampNumber)) {
    return `${timestampMs.toString()} ms`;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(timestampNumber));
}

function getAskBoundsTone(askBounds: OracleAskBoundsModel | undefined) {
  if (askBounds === undefined) {
    return 'neutral';
  }

  switch (askBounds.status) {
    case 'PRESENT_UNMAPPED':
    case 'UNAVAILABLE':
      return 'warning';
  }
}

function getLifecycleTone(status: OracleLifecycleStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING_SETTLEMENT':
      return 'warning';
    case 'SETTLED':
      return 'neutral';
    case 'INACTIVE':
      return 'danger';
  }
}

function getToneClasses(tone: 'danger' | 'neutral' | 'success' | 'warning') {
  switch (tone) {
    case 'danger':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
    case 'success':
      return 'border-[#a9cbbd] bg-[#edf8f3] text-[#244a3c]';
    case 'warning':
      return 'border-[#d9c27d] bg-[#fff9ea] text-[#5c4720]';
    case 'neutral':
      return 'border-[#d9dfdc] bg-[#fbfcfc] text-[#17211d]';
  }
}

function getLifecycleBadgeClasses(status: OracleLifecycleStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'border border-[#a9cbbd] bg-[#edf8f3] text-[#244a3c]';
    case 'PENDING_SETTLEMENT':
      return 'border border-[#d9c27d] bg-[#fff9ea] text-[#5c4720]';
    case 'SETTLED':
      return 'border border-[#b8c6c0] bg-[#f7f9fb] text-[#52615c]';
    case 'INACTIVE':
      return 'border border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Unexpected Predict market read error.';
}

function shortId(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
