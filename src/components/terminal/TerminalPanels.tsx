import type { ReactNode } from 'react';
import { InlineStateNotice, StatePanel } from '@/components/states/StatePrimitives';

export function TerminalPageHeader({
  eyebrow,
  source,
  title,
  titleId,
}: {
  eyebrow: string;
  source: string;
  title: string;
  titleId: string;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-[#d9dfdc] pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]" id={titleId}>
          {title}
        </h1>
      </div>
      <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
        {source}
      </span>
    </header>
  );
}

export function TerminalState({
  children,
  description,
  title,
  tone = 'neutral',
}: {
  children?: ReactNode;
  description: string;
  title: string;
  tone?: 'error' | 'neutral';
}) {
  return (
    <StatePanel description={description} title={title} tone={tone === 'error' ? 'error' : 'empty'}>
      {children}
    </StatePanel>
  );
}

export function TerminalMetricCard({
  helper,
  label,
  value,
}: {
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[#d9dfdc] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-[#17211d]">{value}</p>
      {helper === undefined ? null : (
        <p className="mt-1 text-xs leading-5 text-[#64736e]">{helper}</p>
      )}
    </div>
  );
}

export function TerminalStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-2 break-words font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}

export function TerminalPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section aria-label={title} className="border border-[#d9dfdc] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#17211d]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TerminalDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[#17211d]">{value}</dd>
    </div>
  );
}

export function TerminalKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-1 break-all font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}

export function ManagerIdList({ managerIds }: { managerIds: string[] }) {
  return (
    <ul className="grid gap-2 text-sm">
      {managerIds.map((managerId) => (
        <li className="break-all border border-[#d9dfdc] bg-white p-3" key={managerId}>
          {managerId}
        </li>
      ))}
    </ul>
  );
}

export function TerminalNotice({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <InlineStateNotice className={className}>{children}</InlineStateNotice>;
}

export function TerminalNextSteps({
  steps,
  title = 'After wallet connection',
}: {
  steps: readonly string[];
  title?: string;
}) {
  return (
    <section aria-label={title} className="mt-4 border border-[#d9dfdc] bg-[#fbfcfc] p-4">
      <p className="text-sm font-semibold text-[#17211d]">{title}</p>
      <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#3f514b]">
        {steps.map((step, index) => (
          <li className="flex gap-2" key={step}>
            <span className="font-semibold text-[#315447]">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
