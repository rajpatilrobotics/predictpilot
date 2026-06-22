import { TxDigestLink } from '@/components/tx/TxDigestLink';
import type {
  StrategyReceiptModel,
  StrategyReceiptRow,
  StrategyReceiptState,
  StrategyReceiptWarning,
} from './strategy-receipt';

export interface StrategyReceiptCardProps {
  receipt: StrategyReceiptModel;
  title?: string;
  variant?: 'compact' | 'expanded';
}

export function StrategyReceiptCard({
  receipt,
  title = 'Strategy receipt',
  variant = 'expanded',
}: StrategyReceiptCardProps) {
  const isCompact = variant === 'compact';

  return (
    <section
      aria-label={title}
      className={`border bg-[#fbfcfc] text-[#17211d] ${stateClassName(receipt.state)} ${
        isCompact ? 'p-3' : 'p-5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557266]">
            {title}
          </p>
          <h3 className={`${isCompact ? 'mt-1 text-lg' : 'mt-2 text-xl'} font-semibold`}>
            {receipt.title}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#53645f]">{receipt.description}</p>
        </div>
        <ReceiptStateBadge state={receipt.state}>{receipt.verdict}</ReceiptStateBadge>
      </div>

      <SourceStrip receipt={receipt} />

      <div className={`mt-4 grid gap-3 ${isCompact ? 'lg:grid-cols-2' : 'xl:grid-cols-3'}`}>
        <ReceiptRows rows={receipt.identityRows} title="Strategy" />
        <ReceiptRows rows={receipt.evidenceRows} title="Proof" />
        <ReceiptRows rows={receipt.reconciliationRows} title="Refresh" />
      </div>

      {receipt.digest === null ? (
        <p className="mt-4 border border-[#d9dfdc] bg-white px-3 py-2 text-sm font-semibold text-[#64736e]">
          No digest or explorer proof is shown until a real wallet submission or strict recovery
          produces one.
        </p>
      ) : (
        <div className="mt-4 border border-[#8fbda5] bg-[#edf7f1] p-3 text-sm text-[#25513c]">
          <p className="font-semibold">Submitted digest</p>
          <p className="mt-1 break-all font-mono text-xs">{receipt.digest}</p>
          <TxDigestLink
            className="mt-3 inline-flex border border-[#8ba79c] bg-white px-3 py-2 text-sm font-semibold text-[#315447] transition hover:bg-[#edf5f1]"
            digest={receipt.digest}
            label="Open receipt explorer proof"
          />
        </div>
      )}

      {receipt.warnings.length === 0 ? null : (
        <div className="mt-4 grid gap-2" role="list" aria-label={`${title} warnings`}>
          {receipt.warnings.map((warning) => (
            <ReceiptWarning
              key={`${warning.level}:${warning.source}:${warning.message}`}
              warning={warning}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SourceStrip({ receipt }: { receipt: StrategyReceiptModel }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Receipt evidence sources">
      {receipt.sourceLabels.map((source) => (
        <span
          className="border border-[#d9dfdc] bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#557266]"
          key={source}
        >
          {source}
        </span>
      ))}
    </div>
  );
}

function ReceiptRows({ rows, title }: { rows: StrategyReceiptRow[]; title: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64736e]">{title}</h4>
      <dl className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            className="grid gap-1 border-t border-[#eef2f0] pt-2 first:border-t-0 first:pt-0"
            key={`${title}:${row.label}`}
          >
            <dt className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64736e]">
              {row.label}
              <span className="font-mono text-[10px] text-[#8a9691]">{row.source}</span>
            </dt>
            <dd className="break-words text-sm font-semibold text-[#17211d]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReceiptWarning({ warning }: { warning: StrategyReceiptWarning }) {
  return (
    <div
      className={`border px-3 py-2 text-sm ${warningClassName(warning.level)}`}
      role={warning.level === 'blocked' ? 'alert' : 'listitem'}
    >
      <span className="font-semibold">{warning.source}: </span>
      {warning.message}
    </div>
  );
}

function ReceiptStateBadge({ children, state }: { children: string; state: StrategyReceiptState }) {
  return (
    <span
      className={`border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${stateBadgeClassName(
        state,
      )}`}
    >
      {children}
    </span>
  );
}

function stateClassName(state: StrategyReceiptState) {
  switch (state) {
    case 'verified':
      return 'border-[#8fbda5]';
    case 'failed':
      return 'border-[#df9b9b]';
    case 'pending_index':
      return 'border-[#e0c891]';
    case 'simulation_ready':
    case 'submitted':
      return 'border-[#9fbfb3]';
    case 'draft':
      return 'border-[#d9dfdc]';
  }
}

function stateBadgeClassName(state: StrategyReceiptState) {
  switch (state) {
    case 'verified':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'failed':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'pending_index':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
    case 'simulation_ready':
    case 'submitted':
      return 'border-[#9fbfb3] bg-[#edf5f1] text-[#315447]';
    case 'draft':
      return 'border-[#d9dfdc] bg-white text-[#64736e]';
  }
}

function warningClassName(level: StrategyReceiptWarning['level']) {
  switch (level) {
    case 'blocked':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'caution':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
    case 'info':
      return 'border-[#d9dfdc] bg-white text-[#53645f]';
  }
}
