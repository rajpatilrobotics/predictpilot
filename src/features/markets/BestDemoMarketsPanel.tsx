import type { BestDemoMarketCandidate } from '@/features/markets/lib/best-market-finder';
import type { TimestampMs } from '@/types/predict';

export interface BestDemoMarketsPanelProps {
  candidates: readonly BestDemoMarketCandidate[];
  isCompact?: boolean;
  maxAlternates?: number;
  nowMs: TimestampMs | number;
}

export function BestDemoMarketsPanel({
  candidates,
  isCompact = false,
  maxAlternates = 4,
  nowMs,
}: BestDemoMarketsPanelProps) {
  const topCandidate =
    candidates.find((candidate) => candidate.isEligibleForTopRecommendation) ?? null;
  const alternates = candidates
    .filter((candidate) => candidate.oracleId !== topCandidate?.oracleId)
    .slice(0, maxAlternates);

  if (topCandidate === null) {
    return (
      <section
        aria-label="Best Demo Markets"
        className="border border-[#d9c27d] bg-[#fff9ea] p-4 text-sm text-[#5c4720] shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6a22]">
          Best Demo Markets
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#3f3014]">No good demo markets found</h2>
        <p className="mt-2 max-w-3xl leading-6">
          PredictPilot did not find a live Testnet market that passed the current demo safety
          filters. You can still audit markets manually, but no top recommendation is being claimed.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Best Demo Markets"
      className="border border-[#c8d3ce] bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#446b5e]">
            Best Demo Markets
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-[#17211d]">Best demo market</h2>
            <span className={recommendationClassName(topCandidate.recommendationLabel)}>
              {topCandidate.recommendationLabel}
            </span>
            <span className="border border-[#b8c6c0] bg-[#fbfcfc] px-2 py-1 text-xs font-semibold text-[#315447]">
              Score {topCandidate.marketQualityScore}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615c]">
            Ranked from oracle lifecycle, expiry window, strategy validity, ask-bound availability,
            and current readiness. No profitability claim is made.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">
          Last ranked {formatTimestamp(nowMs)}
        </p>
      </div>

      <div className={`mt-4 grid gap-4 ${isCompact ? '' : 'xl:grid-cols-[1.2fr_0.8fr]'}`}>
        <BestDemoMarketCard candidate={topCandidate} />

        {alternates.length > 0 ? (
          <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3">
            <h3 className="text-sm font-semibold text-[#17211d]">Alternates</h3>
            <div className="mt-3 divide-y divide-[#d9dfdc]">
              {alternates.map((candidate) => (
                <BestDemoMarketRow candidate={candidate} key={candidate.oracleId} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BestDemoMarketCard({ candidate }: { candidate: BestDemoMarketCandidate }) {
  return (
    <article className="border border-[#8ea79e] bg-[#edf5f1] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#446b5e]">
            Recommended current path
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#17211d]">
            {candidate.oracle.underlyingAsset} / {formatTimestamp(candidate.oracle.expiryMs)}
          </h3>
          <p className="mt-1 font-mono text-xs text-[#64736e]">{shortId(candidate.oracleId)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={primaryLinkClassName} href={candidate.strategyHref}>
            Open Best Strategy
          </a>
          <a className={secondaryLinkClassName} href={candidate.auditHref}>
            Audit Oracle
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ChipGroup labels={candidate.reasons} title="Why this market" tone="success" />
        <ChipGroup labels={candidate.warnings} title="Warnings" tone="warning" />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#52615c]">
        Open Best Strategy only preselects this oracle. No transaction is sent automatically.
      </p>
    </article>
  );
}

function BestDemoMarketRow({ candidate }: { candidate: BestDemoMarketCandidate }) {
  return (
    <div className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-semibold text-[#17211d]">
          {candidate.oracle.underlyingAsset} / {formatTimestamp(candidate.oracle.expiryMs)}
        </p>
        <p className="mt-1 text-xs text-[#64736e]">
          Score {candidate.marketQualityScore} · {candidate.recommendationLabel}
        </p>
      </div>
      <a className={secondaryLinkClassName} href={candidate.strategyHref}>
        Open
      </a>
    </div>
  );
}

function ChipGroup({
  labels,
  title,
  tone,
}: {
  labels: readonly { label: string }[];
  title: string;
  tone: 'success' | 'warning';
}) {
  if (labels.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">{title}</p>
        <p className="mt-2 text-sm text-[#52615c]">None</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {labels.slice(0, 6).map((label) => (
          <span className={chipClassName(tone)} key={label.label}>
            {label.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function recommendationClassName(label: BestDemoMarketCandidate['recommendationLabel']) {
  if (label === 'Blocked for live demo') {
    return 'border border-[#d99494] bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#7a2c2c]';
  }

  if (label === 'Recommended with warnings') {
    return 'border border-[#d9c27d] bg-[#fff9ea] px-2 py-1 text-xs font-semibold text-[#6b4d15]';
  }

  return 'border border-[#8ea79e] bg-white px-2 py-1 text-xs font-semibold text-[#244a3c]';
}

function chipClassName(tone: 'success' | 'warning') {
  return tone === 'success'
    ? 'border border-[#8ea79e] bg-white px-2 py-1 text-xs font-semibold text-[#315447]'
    : 'border border-[#d9c27d] bg-[#fff9ea] px-2 py-1 text-xs font-semibold text-[#6b4d15]';
}

function formatTimestamp(value: TimestampMs | number) {
  const timestamp = typeof value === 'bigint' ? Number(value) : value;

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

function shortId(value: string) {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

const primaryLinkClassName =
  'w-fit border border-[#315447] bg-[#315447] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#244a3c]';

const secondaryLinkClassName =
  'w-fit border border-[#8ea79e] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#315447] transition hover:bg-[#edf5f1]';
