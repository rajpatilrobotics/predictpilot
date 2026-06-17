import type { ReactNode } from 'react';

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
  const isError = tone === 'error';

  return (
    <section
      aria-label={title}
      className={`border p-5 ${
        isError
          ? 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]'
          : 'border-[#d9dfdc] bg-[#fbfcfc] text-[#3f514b]'
      }`}
      role={isError ? 'alert' : 'status'}
    >
      <h2 className={`text-xl font-semibold ${isError ? 'text-[#3c1f16]' : 'text-[#17211d]'}`}>
        {title}
      </h2>
      <p className="mt-2 max-w-3xl leading-6">{description}</p>
      {children === undefined ? null : <div className="mt-4">{children}</div>}
    </section>
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
  return (
    <p
      className={`border border-[#e0c891] bg-[#fff9ea] p-3 text-sm leading-6 text-[#5c4720] ${className}`}
    >
      {children}
    </p>
  );
}
