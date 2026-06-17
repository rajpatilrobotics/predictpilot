import type { ReactNode } from 'react';

export type StatePanelTone = 'blocked' | 'empty' | 'error' | 'loading' | 'success' | 'warning';

export interface StatePanelProps {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description: string;
  headingLevel?: 1 | 2;
  label?: string;
  title: string;
  tone?: StatePanelTone;
}

export interface StateSkeletonGridProps {
  className?: string;
  count?: number;
  label?: string;
}

export interface InlineStateNoticeProps {
  children: ReactNode;
  className?: string;
  label?: string;
  tone?: Exclude<StatePanelTone, 'loading'>;
}

export function StatePanel({
  action,
  children,
  className = '',
  description,
  headingLevel = 2,
  label,
  title,
  tone = 'empty',
}: StatePanelProps) {
  const role = getStateRole(tone);
  const toneClassName = getStateToneClassName(tone);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <section
      aria-label={label ?? title}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={`border p-5 text-sm ${toneClassName} ${className}`}
      role={role}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Heading
            className={`font-semibold text-current ${
              headingLevel === 1 ? 'text-3xl tracking-normal' : 'text-xl'
            }`}
          >
            {title}
          </Heading>
          <p className="mt-2 max-w-3xl leading-6">{description}</p>
        </div>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </div>
      {children === undefined ? null : <div className="mt-4">{children}</div>}
    </section>
  );
}

export function StateSkeletonGrid({
  className = '',
  count = 3,
  label = 'Loading content',
}: StateSkeletonGridProps) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={`grid gap-3 md:grid-cols-3 ${className}`}
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          aria-hidden="true"
          className="h-14 animate-pulse border border-[#d9dfdc] bg-[#e8eeee]"
          key={index}
        />
      ))}
    </div>
  );
}

export function InlineStateNotice({
  children,
  className = '',
  label,
  tone = 'warning',
}: InlineStateNoticeProps) {
  const role = tone === 'blocked' || tone === 'error' ? 'alert' : 'status';

  return (
    <div
      aria-label={label}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={`border p-3 text-sm leading-6 ${getInlineToneClassName(tone)} ${className}`}
      role={role}
    >
      {children}
    </div>
  );
}

function getStateRole(tone: StatePanelTone) {
  return tone === 'blocked' || tone === 'error' ? 'alert' : 'status';
}

function getStateToneClassName(tone: StatePanelTone) {
  switch (tone) {
    case 'blocked':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
    case 'empty':
      return 'border-[#d9dfdc] bg-[#fbfcfc] text-[#3f514b]';
    case 'error':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'loading':
      return 'border-[#d9dfdc] bg-[#f8fbfa] text-[#445750]';
    case 'success':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'warning':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
  }
}

function getInlineToneClassName(tone: Exclude<StatePanelTone, 'loading'>) {
  switch (tone) {
    case 'blocked':
      return 'border-[#d6a38f] bg-[#fff8f4] text-[#563023]';
    case 'empty':
      return 'border-[#d9dfdc] bg-[#fbfcfc] text-[#3f514b]';
    case 'error':
      return 'border-[#df9b9b] bg-[#fff4f4] text-[#6d2b2b]';
    case 'success':
      return 'border-[#8fbda5] bg-[#edf7f1] text-[#25513c]';
    case 'warning':
      return 'border-[#e0c891] bg-[#fff9ea] text-[#5c4720]';
  }
}
