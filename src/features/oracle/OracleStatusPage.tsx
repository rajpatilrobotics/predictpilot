import type { ReactNode } from 'react';
import { useLiveOracleTape } from '@/features/oracle/hooks/useLiveOracleTape';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import {
  getOracleStatus,
  type OracleActionAvailability,
  type OracleStatusReasonCode,
} from '@/lib/oracle-status';
import type { DataFreshnessModel, DataFreshnessStatus } from '@/lib/freshness';
import type { OracleStateModel } from '@/types/oracle';
import type { ObjectId, TimestampMs } from '@/types/predict';

export interface OracleStatusPageProps {
  client?: OracleReadClient;
  nowMs?: number | TimestampMs;
  oracleId?: ObjectId;
  pollIntervalMs?: number;
}

export function OracleStatusPage({ oracleId, ...props }: OracleStatusPageProps) {
  if (oracleId === undefined) {
    return (
      <OracleEmptyState
        description="Select an OracleSVI market before reading lifecycle, freshness, and settlement context."
        title="No oracle selected"
      />
    );
  }

  return <OracleStatusPageContent oracleId={oracleId} {...props} />;
}

function OracleStatusPageContent({
  client,
  nowMs,
  oracleId,
  pollIntervalMs,
}: Required<Pick<OracleStatusPageProps, 'oracleId'>> & Omit<OracleStatusPageProps, 'oracleId'>) {
  const liveTape = useLiveOracleTape({
    client,
    nowMs,
    oracleId,
    pollIntervalMs,
  });

  if (liveTape.data === undefined) {
    if (liveTape.isError) {
      return (
        <OracleUnavailableState
          message={liveTape.error?.message ?? 'Oracle state unavailable.'}
          title="Oracle state unavailable"
        />
      );
    }

    return <OracleLoadingState title="Loading oracle status" />;
  }

  const oracleState = liveTape.data.latestOracleState;
  const status = getOracleStatus({
    nowMs: nowMs ?? liveTape.data.lastPollAtMs,
    oracleState,
  });

  return (
    <article aria-labelledby="oracle-status-title" className="space-y-5 text-[#17211d]">
      <header className="border-b border-[#d9dfdc] pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              OracleSVI Health
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal" id="oracle-status-title">
              Oracle Status
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615c]">
              Read-only lifecycle and freshness view. Indexed server polling is used for rendering;
              no wallet execution or PTB construction is available in this lane.
            </p>
          </div>
          <LifecycleBadge lifecycleStatus={oracleState.oracle.lifecycleStatus} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Oracle identity">
        <MetricCard label="Oracle ID" value={formatObjectId(oracleState.oracle.oracleId)} />
        <MetricCard label="Underlying" value={oracleState.oracle.underlyingAsset} />
        <MetricCard label="Expiry" value={formatTimestamp(oracleState.oracle.expiryMs)} />
        <MetricCard label="Expiry state" value={status.expiryStatus} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel title="Freshness and price">
          <div className="grid gap-3 md:grid-cols-2">
            <FreshnessCard freshness={status.freshness.price} label="Latest price" />
            <FreshnessCard freshness={status.freshness.svi} label="Latest SVI" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Spot"
              value={
                oracleState.latestPrice === null
                  ? 'Unavailable'
                  : formatScaled1e9(oracleState.latestPrice.spot1e9)
              }
            />
            <MetricCard
              label="Forward"
              value={
                oracleState.latestPrice === null
                  ? 'Unavailable'
                  : formatScaled1e9(oracleState.latestPrice.forward1e9)
              }
            />
          </div>
          {oracleState.latestPrice === null ? (
            <UnavailableNotice>
              Latest price unavailable. Mint and live quote context must stay blocked until a
              verified price update is available.
            </UnavailableNotice>
          ) : null}
        </Panel>

        <Panel title="Lifecycle and settlement">
          <dl className="grid gap-3">
            <Datum label="Lifecycle" value={formatLifecycle(oracleState.oracle.lifecycleStatus)} />
            <Datum
              label="Activated"
              value={formatNullableTimestamp(oracleState.oracle.activatedAtMs)}
            />
            <Datum
              label="Settlement price"
              value={formatNullableScaled1e9(oracleState.oracle.settlementPrice1e9)}
            />
            <Datum
              label="Settled at"
              value={formatNullableTimestamp(oracleState.oracle.settledAtMs)}
            />
          </dl>
          <p className="mt-4 border border-[#d9dfdc] bg-[#fbfcfc] p-3 text-sm leading-6 text-[#3f514b]">
            {getSettlementCopy(oracleState)}
          </p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Tradeability explanation">
          <div className="grid gap-3">
            <ActionAvailabilityCard availability={status.mint} label="Mint" />
            <ActionAvailabilityCard availability={status.mintRange} label="Range mint" />
            <ActionAvailabilityCard availability={status.redeem} label="Redeem" />
            <ActionAvailabilityCard availability={status.redeemRange} label="Range redeem" />
          </div>
        </Panel>

        <Panel title="Live tape status">
          <dl className="grid gap-3 md:grid-cols-2">
            <Datum label="Source" value={liveTape.data.source} />
            <Datum label="Polling" value={`${liveTape.data.pollIntervalMs.toLocaleString()}ms`} />
            <Datum label="Updates observed" value={liveTape.data.updateCount.toString()} />
            <Datum label="Fetch state" value={liveTape.isFetching ? 'Refreshing' : 'Idle'} />
            <Datum label="Last poll" value={formatTimestamp(liveTape.data.lastPollAtMs)} />
            <Datum
              label="Last lifecycle"
              value={formatLifecycle(liveTape.data.lastObservedLifecycleStatus)}
            />
          </dl>
          <div className="mt-4 border border-[#d9dfdc] bg-[#fbfcfc] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#52615c]">
              Verified event labels
            </p>
            <ul className="mt-2 grid gap-2 text-sm text-[#3f514b]">
              {liveTape.eventMetadata.eventTypeSuffixes.map((eventType) => (
                <li className="break-words" key={eventType}>
                  {eventType}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </section>
    </article>
  );
}

function ActionAvailabilityCard({
  availability,
  label,
}: {
  availability: OracleActionAvailability;
  label: string;
}) {
  const actionText = availability.isAllowed ? 'available' : 'blocked';

  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-[#17211d]">
          {label} is {actionText}
        </p>
        <span className={statusClassName(availability.status)}>{availability.status}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#52615c]">
        {availability.requiresAuthoritativeRefresh
          ? 'Requires an authoritative refresh before any signing flow can rely on this state.'
          : 'No signing flow is exposed from this read-only page.'}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.1em] text-[#64736e]">
        {availability.reasonCodes.map(reasonLabel).join(' / ')}
      </p>
    </div>
  );
}

function FreshnessCard({ freshness, label }: { freshness: DataFreshnessModel; label: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
          <p className="mt-2 font-semibold text-[#17211d]">
            {freshnessBadgeLabel(freshness.status)}
          </p>
        </div>
        <span className={freshnessClassName(freshness.status)}>{freshness.status}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <Datum label="Age" value={formatAge(freshness.ageMs)} />
        <Datum label="Timestamp" value={formatNullableTimestamp(freshness.lastUpdatedAtMs)} />
        <Datum label="Stale after" value={formatDuration(freshness.staleAfterMs)} />
      </dl>
    </div>
  );
}

function LifecycleBadge({
  lifecycleStatus,
}: {
  lifecycleStatus: OracleStateModel['oracle']['lifecycleStatus'];
}) {
  return (
    <span className={lifecycleClassName(lifecycleStatus)}>{formatLifecycle(lifecycleStatus)}</span>
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
    <p className="mt-4 border border-[#e0c891] bg-[#fff9ea] p-3 text-sm leading-6 text-[#5c4720]">
      {children}
    </p>
  );
}

function OracleEmptyState({ description, title }: { description: string; title: string }) {
  return (
    <article aria-labelledby="oracle-empty-title" className="border border-[#d9dfdc] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
        OracleSVI Health
      </p>
      <h1
        className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]"
        id="oracle-empty-title"
      >
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#52615c]">{description}</p>
    </article>
  );
}

function OracleLoadingState({ title }: { title: string }) {
  return (
    <article aria-label={title} className="border border-[#d9dfdc] bg-white p-5" role="status">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
        OracleSVI Health
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#52615c]">
        Reading indexed oracle state through the existing live tape hook.
      </p>
    </article>
  );
}

function OracleUnavailableState({ message, title }: { message: string; title: string }) {
  return (
    <article aria-label={title} className="border border-[#d9a8a0] bg-[#fff8f6] p-5" role="alert">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a3e32]">
        OracleSVI Health
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#6d423b]">{message}</p>
    </article>
  );
}

function getSettlementCopy(oracleState: OracleStateModel) {
  if (oracleState.oracle.lifecycleStatus === 'SETTLED') {
    if (oracleState.oracle.settlementPrice1e9 === null) {
      return 'Settled OracleSVI, but settlement price is unavailable. TODO VERIFY before showing redeem-critical values.';
    }

    return 'Settled OracleSVI. Mint is blocked; redeem context can reference the indexed settlement price shown here.';
  }

  if (oracleState.oracle.lifecycleStatus === 'PENDING_SETTLEMENT') {
    return 'Pending settlement means expiry has passed and the oracle is waiting for settlement context to become available.';
  }

  if (oracleState.oracle.lifecycleStatus === 'ACTIVE') {
    return 'Active OracleSVI can receive live price and SVI updates while expiry remains open.';
  }

  return 'Inactive OracleSVI is not live for mint flows.';
}

function reasonLabel(reason: OracleStatusReasonCode) {
  switch (reason) {
    case 'ORACLE_ACTIVE':
      return 'oracle active';
    case 'ORACLE_DELAYED':
      return 'oracle aging';
    case 'ORACLE_EXPIRED':
      return 'oracle expired';
    case 'ORACLE_INACTIVE':
      return 'oracle inactive';
    case 'ORACLE_PENDING_SETTLEMENT':
      return 'pending settlement';
    case 'ORACLE_PRICE_MISSING':
      return 'price missing';
    case 'ORACLE_SETTLED':
      return 'oracle settled';
    case 'ORACLE_STALE':
      return 'oracle stale';
    case 'ORACLE_SVI_MISSING':
      return 'SVI missing';
    case 'SETTLED_REDEEM_AVAILABLE':
      return 'settled redeem available';
    case 'SETTLEMENT_PRICE_MISSING':
      return 'settlement price missing';
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

  return formatDuration(ageMs);
}

function formatDuration(durationMs: bigint) {
  if (durationMs < 1_000n) {
    return `${durationMs.toString()}ms`;
  }

  const secondsText = (Number(durationMs) / 1_000).toFixed(1).replace(/\.0$/, '');
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

function statusClassName(status: OracleActionAvailability['status']) {
  switch (status) {
    case 'AVAILABLE':
      return 'w-fit border border-[#a7d6bd] bg-[#eef9f3] px-2 py-1 text-xs font-semibold text-[#24633e]';
    case 'WARNING':
      return 'w-fit border border-[#e0c891] bg-[#fff9ea] px-2 py-1 text-xs font-semibold text-[#6a511d]';
    case 'BLOCKED':
      return 'w-fit border border-[#d9a8a0] bg-[#fff8f6] px-2 py-1 text-xs font-semibold text-[#8a3e32]';
  }
}
