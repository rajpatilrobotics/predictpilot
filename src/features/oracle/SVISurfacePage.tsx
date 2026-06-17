import type { ReactNode } from 'react';
import { useLiveOracleTape } from '@/features/oracle/hooks/useLiveOracleTape';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import { getOracleStatus } from '@/lib/oracle-status';
import type { DataFreshnessModel, DataFreshnessStatus } from '@/lib/freshness';
import type { OracleStateModel, OracleSviParametersModel } from '@/types/oracle';
import type { ObjectId, TimestampMs } from '@/types/predict';

export interface SVISurfacePageProps {
  client?: OracleReadClient;
  nowMs?: number | TimestampMs;
  oracleId?: ObjectId;
  pollIntervalMs?: number;
}

export function SVISurfacePage({ oracleId, ...props }: SVISurfacePageProps) {
  if (oracleId === undefined) {
    return (
      <SurfaceEmptyState
        description="Select an OracleSVI market before inspecting parameters and surface availability."
        title="No oracle selected"
      />
    );
  }

  return <SVISurfacePageContent oracleId={oracleId} {...props} />;
}

function SVISurfacePageContent({
  client,
  nowMs,
  oracleId,
  pollIntervalMs,
}: Required<Pick<SVISurfacePageProps, 'oracleId'>> & Omit<SVISurfacePageProps, 'oracleId'>) {
  const liveTape = useLiveOracleTape({
    client,
    nowMs,
    oracleId,
    pollIntervalMs,
  });

  if (liveTape.data === undefined) {
    if (liveTape.isError) {
      return (
        <SurfaceUnavailableState
          message={liveTape.error?.message ?? 'SVI state unavailable.'}
          title="SVI state unavailable"
        />
      );
    }

    return <SurfaceLoadingState title="Loading SVI surface" />;
  }

  const oracleState = liveTape.data.latestOracleState;
  const status = getOracleStatus({
    nowMs: nowMs ?? liveTape.data.lastPollAtMs,
    oracleState,
  });

  return (
    <article aria-labelledby="svi-surface-title" className="space-y-5 text-[#17211d]">
      <header className="border-b border-[#d9dfdc] pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              OracleSVI Surface
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal" id="svi-surface-title">
              SVI Surface Explorer
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615c]">
              Parameter-first read-only explorer. This page shows verified fields from the existing
              oracle state model and marks unsupported surface math as unavailable.
            </p>
          </div>
          <span className={lifecycleClassName(oracleState.oracle.lifecycleStatus)}>
            {formatLifecycle(oracleState.oracle.lifecycleStatus)}
          </span>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="SVI context">
        <MetricCard label="Underlying" value={oracleState.oracle.underlyingAsset} />
        <MetricCard label="Oracle ID" value={formatObjectId(oracleState.oracle.oracleId)} />
        <MetricCard label="Expiry" value={formatTimestamp(oracleState.oracle.expiryMs)} />
        <MetricCard label="Freshness" value={status.freshness.aggregateStatus} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Current SVI parameters">
          {oracleState.latestSvi === null ? (
            <UnavailableNotice>
              SVI parameters unavailable. TODO VERIFY the server state before rendering any smile,
              surface, replay, or parameter-derived chart.
            </UnavailableNotice>
          ) : (
            <SviParameterGrid svi={oracleState.latestSvi.svi} />
          )}
          <div className="mt-4">
            <FreshnessStrip freshness={status.freshness.svi} label="SVI freshness" />
          </div>
        </Panel>

        <Panel title="Price vs forward context">
          {oracleState.latestPrice === null ? (
            <UnavailableNotice>
              Latest price unavailable. Price, forward, and derived spread context are unavailable.
            </UnavailableNotice>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Spot" value={formatScaled1e9(oracleState.latestPrice.spot1e9)} />
              <MetricCard
                label="Forward"
                value={formatScaled1e9(oracleState.latestPrice.forward1e9)}
              />
              <MetricCard
                label="Forward minus spot"
                value={formatScaled1e9(
                  oracleState.latestPrice.forward1e9 - oracleState.latestPrice.spot1e9,
                )}
              />
            </div>
          )}
          <div className="mt-4">
            <FreshnessStrip freshness={status.freshness.price} label="Price freshness" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel title="Surface availability">
          <div className="border border-dashed border-[#b8c6c0] bg-[#fbfcfc] p-5">
            <p className="text-lg font-semibold text-[#17211d]">Surface derivation unavailable</p>
            <p className="mt-2 text-sm leading-6 text-[#52615c]">
              TODO VERIFY SVI visualization math and history support before rendering volatility
              smiles, 3D surfaces, replay timelines, butterfly flags, or calendar flags. The current
              lane only has latest OracleSVI parameters from the existing oracle state model.
            </p>
          </div>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <Datum
              label="Latest SVI timestamp"
              value={formatNullableTimestamp(liveTape.data.lastObservedSviTimestampMs)}
            />
            <Datum
              label="Latest price timestamp"
              value={formatNullableTimestamp(liveTape.data.lastObservedPriceTimestampMs)}
            />
            <Datum label="Ask bounds" value={formatAskBounds(oracleState)} />
            <Datum label="Execution" value="Unavailable in this lane" />
          </dl>
        </Panel>

        <Panel title="Expiry and settlement">
          <dl className="grid gap-3">
            <Datum label="Expiry state" value={status.expiryStatus} />
            <Datum label="Lifecycle" value={formatLifecycle(oracleState.oracle.lifecycleStatus)} />
            <Datum
              label="Settlement price"
              value={formatNullableScaled1e9(oracleState.oracle.settlementPrice1e9)}
            />
            <Datum
              label="Settled at"
              value={formatNullableTimestamp(oracleState.oracle.settledAtMs)}
            />
            <Datum label="Live tape updates" value={liveTape.data.updateCount.toString()} />
            <Datum label="Live tape source" value={liveTape.data.source} />
          </dl>
        </Panel>
      </section>
    </article>
  );
}

function SviParameterGrid({ svi }: { svi: OracleSviParametersModel }) {
  const parameters = [
    { label: 'a', value: svi.a1e9 },
    { label: 'b', value: svi.b1e9 },
    { label: 'rho', value: svi.rho1e9Signed },
    { label: 'm', value: svi.m1e9Signed },
    { label: 'sigma', value: svi.sigma1e9 },
  ] as const;

  return (
    <div className="grid gap-3 md:grid-cols-5" aria-label="SVI parameters present">
      {parameters.map((parameter) => (
        <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3" key={parameter.label}>
          <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{parameter.label}</p>
          <p className="mt-2 break-words font-semibold text-[#17211d]">
            {formatScaled1e9(parameter.value)}
          </p>
          <p className="mt-1 break-words text-xs text-[#64736e]">
            raw {parameter.value.toString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function FreshnessStrip({ freshness, label }: { freshness: DataFreshnessModel; label: string }) {
  return (
    <div className="flex flex-col gap-3 border border-[#d9dfdc] bg-[#fbfcfc] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
        <p className="mt-1 text-sm font-semibold text-[#17211d]">
          {freshnessBadgeLabel(freshness.status)} - age {formatAge(freshness.ageMs)}
        </p>
      </div>
      <span className={freshnessClassName(freshness.status)}>{freshness.status}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-2 break-words font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="border border-[#d9dfdc] bg-white p-4" aria-label={title}>
      <h2 className="text-lg font-semibold text-[#17211d]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[#17211d]">{value}</dd>
    </div>
  );
}

function UnavailableNotice({ children }: { children: ReactNode }) {
  return (
    <p className="border border-[#e0c891] bg-[#fff9ea] p-3 text-sm leading-6 text-[#5c4720]">
      {children}
    </p>
  );
}

function SurfaceEmptyState({ description, title }: { description: string; title: string }) {
  return (
    <article aria-labelledby="surface-empty-title" className="border border-[#d9dfdc] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
        OracleSVI Surface
      </p>
      <h1
        className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]"
        id="surface-empty-title"
      >
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#52615c]">{description}</p>
    </article>
  );
}

function SurfaceLoadingState({ title }: { title: string }) {
  return (
    <article aria-label={title} className="border border-[#d9dfdc] bg-white p-5" role="status">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
        OracleSVI Surface
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#52615c]">
        Reading latest OracleSVI fields through the existing live tape hook.
      </p>
    </article>
  );
}

function SurfaceUnavailableState({ message, title }: { message: string; title: string }) {
  return (
    <article aria-label={title} className="border border-[#d9a8a0] bg-[#fff8f6] p-5" role="alert">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a3e32]">
        OracleSVI Surface
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#6d423b]">{message}</p>
    </article>
  );
}

function formatAskBounds(oracleState: OracleStateModel) {
  switch (oracleState.askBounds.status) {
    case 'PRESENT_UNMAPPED':
      return 'Present, unmapped';
    case 'UNAVAILABLE':
      return 'Unavailable';
  }
}

function freshnessBadgeLabel(status: DataFreshnessStatus) {
  switch (status) {
    case 'FRESH':
      return 'Live';
    case 'DELAYED':
      return 'Aging';
    case 'STALE':
      return 'Stale';
    case 'UNKNOWN':
      return 'Unavailable';
  }
}

function formatLifecycle(status: OracleStateModel['oracle']['lifecycleStatus']) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function formatObjectId(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatNullableScaled1e9(value: bigint | null) {
  return value === null ? 'Not set' : formatScaled1e9(value);
}

function formatScaled1e9(value: bigint) {
  const scale = 1_000_000_000n;
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;
  const whole = absoluteValue / scale;
  const fraction = (absoluteValue % scale).toString().padStart(9, '0').replace(/0+$/, '');
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNegative ? '-' : '';

  return fraction.length === 0 ? `${sign}${wholeText}` : `${sign}${wholeText}.${fraction}`;
}

function formatNullableTimestamp(value: bigint | null) {
  return value === null ? 'Unavailable' : formatTimestamp(value);
}

function formatTimestamp(value: bigint) {
  const timestamp = Number(value);

  if (!Number.isSafeInteger(timestamp)) {
    return value.toString();
  }

  return new Date(timestamp).toISOString();
}

function formatAge(ageMs: bigint | null) {
  if (ageMs === null) {
    return 'Unavailable';
  }

  if (ageMs < 1_000n) {
    return `${ageMs.toString()}ms`;
  }

  const secondsText = (Number(ageMs) / 1_000).toFixed(1).replace(/\.0$/, '');
  return `${secondsText}s`;
}

function freshnessClassName(status: DataFreshnessStatus) {
  switch (status) {
    case 'FRESH':
      return 'border border-[#a7d6bd] bg-[#eef9f3] px-2 py-1 text-xs font-semibold text-[#24633e]';
    case 'DELAYED':
      return 'border border-[#e0c891] bg-[#fff9ea] px-2 py-1 text-xs font-semibold text-[#6a511d]';
    case 'STALE':
      return 'border border-[#d9a8a0] bg-[#fff8f6] px-2 py-1 text-xs font-semibold text-[#8a3e32]';
    case 'UNKNOWN':
      return 'border border-[#c8d3ce] bg-[#f4f7f6] px-2 py-1 text-xs font-semibold text-[#52615c]';
  }
}

function lifecycleClassName(status: OracleStateModel['oracle']['lifecycleStatus']) {
  switch (status) {
    case 'ACTIVE':
      return 'w-fit border border-[#a7d6bd] bg-[#eef9f3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#24633e]';
    case 'PENDING_SETTLEMENT':
      return 'w-fit border border-[#e0c891] bg-[#fff9ea] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6a511d]';
    case 'SETTLED':
      return 'w-fit border border-[#adc5d8] bg-[#eef6fc] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#285a7b]';
    case 'INACTIVE':
      return 'w-fit border border-[#c8d3ce] bg-[#f4f7f6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#52615c]';
  }
}
