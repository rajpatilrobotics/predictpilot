import type {
  OracleHealthAuditCheckStatus,
  OracleHealthAuditModel,
  OracleHealthAuditStatus,
} from '@/features/oracle/lib/oracle-health-audit';

export function OracleHealthAuditCard({
  audit,
  title = 'Oracle Health Audit',
  variant = 'full',
}: {
  audit: OracleHealthAuditModel;
  title?: string;
  variant?: 'compact' | 'full';
}) {
  const isCompact = variant === 'compact';

  return (
    <section
      aria-label={title}
      className={`border bg-white shadow-sm ${statusBorderClassName(audit.status)} ${
        isCompact ? 'p-3' : 'p-5'
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557266]">
            {title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className={`${isCompact ? 'text-base' : 'text-xl'} font-semibold text-[#17211d]`}>
              {audit.title}
            </h2>
            <span className={statusBadgeClassName(audit.status)}>{audit.status}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#52615c]">{audit.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {audit.sourceLabels.map((source) => (
            <span
              className="border border-[#d9dfdc] bg-[#fbfcfc] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#52615c]"
              key={source}
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`mt-4 grid gap-2 ${isCompact ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}
      >
        {audit.checks.map((check) => (
          <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-3" key={check.label}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64736e]">
                {check.label}
              </p>
              <span className={checkBadgeClassName(check.status)}>{check.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#3f514b]">{check.detail}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#7a8782]">
              Source: {check.source}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function statusBorderClassName(status: OracleHealthAuditStatus) {
  switch (status) {
    case 'HEALTHY':
      return 'border-[#a7d6bd]';
    case 'CAUTION':
      return 'border-[#d7bd75]';
    case 'BLOCKED':
      return 'border-[#d9a8a0]';
    case 'UNKNOWN':
      return 'border-[#c8d3ce]';
  }
}

function statusBadgeClassName(status: OracleHealthAuditStatus) {
  switch (status) {
    case 'HEALTHY':
      return 'border border-[#a7d6bd] bg-[#eef9f3] px-2 py-1 text-xs font-semibold text-[#24633e]';
    case 'CAUTION':
      return 'border border-[#e0c891] bg-[#fff9ea] px-2 py-1 text-xs font-semibold text-[#6a511d]';
    case 'BLOCKED':
      return 'border border-[#d9a8a0] bg-[#fff8f6] px-2 py-1 text-xs font-semibold text-[#8a3e32]';
    case 'UNKNOWN':
      return 'border border-[#c8d3ce] bg-[#fbfcfc] px-2 py-1 text-xs font-semibold text-[#52615c]';
  }
}

function checkBadgeClassName(status: OracleHealthAuditCheckStatus) {
  switch (status) {
    case 'pass':
      return 'text-xs font-semibold uppercase tracking-[0.1em] text-[#24633e]';
    case 'caution':
      return 'text-xs font-semibold uppercase tracking-[0.1em] text-[#6a511d]';
    case 'blocked':
      return 'text-xs font-semibold uppercase tracking-[0.1em] text-[#8a3e32]';
    case 'unknown':
      return 'text-xs font-semibold uppercase tracking-[0.1em] text-[#52615c]';
  }
}
