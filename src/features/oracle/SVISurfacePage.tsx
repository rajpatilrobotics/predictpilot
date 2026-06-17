import {
  TerminalDatum as Datum,
  TerminalNotice as UnavailableNotice,
  TerminalPanel as Panel,
  TerminalStatCard as MetricCard,
} from '@/components/terminal/TerminalPanels';
import { useLiveOracleTape } from '@/features/oracle/hooks/useLiveOracleTape';
import {
  freshnessBadgeLabel,
  freshnessClassName,
  lifecycleClassName,
} from '@/features/oracle/lib/oracle-page-format';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import {
  formatAge,
  formatLifecycleLabel as formatLifecycle,
  formatNullableScaled1e9,
  formatNullableTimestamp,
  formatObjectId,
  formatSafeIsoTimestamp as formatTimestamp,
  formatScaled1e9,
} from '@/lib/formatters';
import { getOracleStatus } from '@/lib/oracle-status';
import type { DataFreshnessModel } from '@/lib/freshness';
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
