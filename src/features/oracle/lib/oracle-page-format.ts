import type { DataFreshnessStatus } from '@/lib/freshness';
import type { OracleLifecycleStatus } from '@/types/oracle';

export function freshnessBadgeLabel(status: DataFreshnessStatus) {
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

export function freshnessClassName(status: DataFreshnessStatus) {
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

export function lifecycleClassName(status: OracleLifecycleStatus) {
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
