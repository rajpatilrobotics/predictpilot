import type { ReactNode } from 'react';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import type { PnlPointModel } from '@/types/history';
import type { ManagerPnlModel } from '@/types/portfolio';
import { usePnl } from './hooks/usePnl';

export function PnlPage() {
  const wallet = useWalletStatus();
  const manager = usePredictManager();
  const managerId = manager.managerId ?? undefined;
  const canLoadPnl = wallet.isConnected && manager.isReady && managerId !== undefined;
  const pnlQuery = usePnl({
    enabled: canLoadPnl,
    managerId,
    range: 'ALL',
  });

  let content;

  if (!wallet.isConnected) {
    content = (
      <PnlState
        description="Connect a Sui Testnet wallet before loading manager-level PnL."
        title="Connect wallet to view PnL"
      />
    );
  } else if (manager.isLoading || manager.isConfirming) {
    content = (
      <PnlState
        description="Checking indexed manager discovery and confirming the selected PredictManager before loading PnL."
        title="Loading PredictManager"
      />
    );
  } else if (manager.requiresCreateManager) {
    content = (
      <PnlState
        description="No PredictManager was found for this wallet. PnL appears after a manager exists and has indexed activity."
        title="No PredictManager found"
      />
    );
  } else if (manager.isAmbiguous) {
    content = (
      <PnlState
        description="More than one manager matched the connected wallet. This read-only page will not choose a manager automatically."
        title="Ambiguous PredictManager"
      >
        <ManagerList managerIds={manager.matchingManagers.map((item) => item.managerId)} />
      </PnlState>
    );
  } else if (manager.error !== null) {
    content = (
      <PnlState
        description={manager.error.message}
        title="PnL manager lookup failed"
        tone="error"
      />
    );
  } else if (pnlQuery.isLoading || pnlQuery.isPending) {
    content = (
      <PnlState
        description="Loading the manager PnL series from the indexed Predict server surface."
        title="Loading PnL"
      />
    );
  } else if (pnlQuery.error !== null) {
    content = (
      <PnlState description={pnlQuery.error.message} title="PnL query failed" tone="error" />
    );
  } else if (pnlQuery.data === undefined) {
    content = (
      <PnlState
        description="PnL is idle because no ready manager is selected."
        title="PnL unavailable"
      />
    );
  } else {
    content = <PnlSuccess pnl={pnlQuery.data} />;
  }

  return (
    <article aria-labelledby="pnl-page-title" className="space-y-5">
      <PageHeader eyebrow="Assets" source="Indexed manager PnL" title="PnL" />
      {content}
    </article>
  );
}

function PnlSuccess({ pnl }: { pnl: ManagerPnlModel }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3" aria-label="PnL summary">
        <MetricCard
          helper={`Range ${pnl.range}`}
          label="Current total PnL"
          value={formatQuoteAmount(pnl.currentTotalPnlQuote)}
        />
        <MetricCard
          helper="Indexed unrealized estimate"
          label="Unrealized PnL"
          value={formatQuoteAmount(pnl.currentUnrealizedPnlQuote)}
        />
        <MetricCard
          helper={pnl.seriesType ?? 'No series type supplied'}
          label="PnL points"
          value={String(pnl.points.length)}
        />
      </section>

      {pnl.points.length === 0 ? (
        <PnlState
          description="The PnL endpoint returned successfully but has no points for this manager yet."
          title="No PnL points"
        />
      ) : (
        <section className="space-y-4" aria-label="PnL success state">
          <PnlChart points={pnl.points} />
          <PnlTable points={pnl.points} />
        </section>
      )}
    </div>
  );
}

function PnlChart({ points }: { points: PnlPointModel[] }) {
  const path = buildPnlPath(points);

  return (
    <section aria-labelledby="pnl-chart-title" className="border border-[#d9dfdc] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#17211d]" id="pnl-chart-title">
          Cumulative PnL chart
        </h2>
        <span className="border border-[#b8c6c0] bg-[#edf5f1] px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
          ALL
        </span>
      </div>
      <svg aria-label="Manager PnL chart" className="mt-4 h-56 w-full" role="img" viewBox="0 0 640 220">
        <line stroke="#d9dfdc" strokeWidth="1" x1="0" x2="640" y1="190" y2="190" />
        <line stroke="#d9dfdc" strokeWidth="1" x1="0" x2="640" y1="30" y2="30" />
        {path.kind === 'single' ? (
          <circle cx={path.x} cy={path.y} fill="#176b5b" r="5" />
        ) : (
          <polyline fill="none" points={path.points} stroke="#176b5b" strokeWidth="3" />
        )}
      </svg>
    </section>
  );
}

function PnlTable({ points }: { points: PnlPointModel[] }) {
  return (
    <section aria-labelledby="pnl-table-title" className="space-y-3">
      <h2 className="text-lg font-semibold text-[#17211d]" id="pnl-table-title">
        PnL points
      </h2>
      <div className="overflow-x-auto border border-[#d9dfdc]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#edf5f1] text-xs uppercase tracking-[0.12em] text-[#46635a]">
            <tr>
              <th className="p-3 font-semibold">Timestamp</th>
              <th className="p-3 font-semibold">PnL</th>
              <th className="p-3 font-semibold">Realized</th>
              <th className="p-3 font-semibold">Unrealized</th>
              <th className="p-3 font-semibold">Equity</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr className="border-t border-[#d9dfdc]" key={point.timestampMs.toString()}>
                <td className="p-3 text-[#3f514b]">{formatTimestamp(point.timestampMs)}</td>
                <td className="p-3 font-semibold text-[#17211d]">
                  {formatQuoteAmount(point.pnlQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">
                  {formatOptionalQuoteAmount(point.realizedPnlQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">
                  {formatOptionalQuoteAmount(point.unrealizedPnlQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">
                  {formatOptionalQuoteAmount(point.equityQuote)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PageHeader({
  eyebrow,
  source,
  title,
}: {
  eyebrow: string;
  source: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-[#d9dfdc] pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]" id="pnl-page-title">
          {title}
        </h1>
      </div>
      <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
        {source}
      </span>
    </header>
  );
}

function PnlState({
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

function MetricCard({ helper, label, value }: { helper: string; label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-[#17211d]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#64736e]">{helper}</p>
    </div>
  );
}

function ManagerList({ managerIds }: { managerIds: string[] }) {
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

function buildPnlPath(points: PnlPointModel[]) {
  const width = 640;
  const minY = 30;
  const maxY = 190;
  const values = points.map((point) => Number(point.pnlQuote));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const xStep = points.length <= 1 ? 0 : width / (points.length - 1);
  const coordinates = values.map((value, index) => {
    const x = points.length <= 1 ? width / 2 : index * xStep;
    const normalized = (value - minValue) / valueRange;
    const y = maxY - normalized * (maxY - minY);
    return { x, y };
  });

  if (coordinates.length === 1) {
    return { kind: 'single' as const, x: coordinates[0].x, y: coordinates[0].y };
  }

  return {
    kind: 'line' as const,
    points: coordinates.map((coordinate) => `${coordinate.x},${coordinate.y}`).join(' '),
  };
}

function formatQuoteAmount(value: bigint) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = absolute % 1_000_000n;
  const fractionText = fraction.toString().padStart(6, '0').replace(/0+$/, '');

  return `${sign}${whole.toLocaleString()}${fractionText === '' ? '' : `.${fractionText}`} dUSDC`;
}

function formatOptionalQuoteAmount(value: bigint | undefined) {
  return value === undefined ? 'Unavailable' : formatQuoteAmount(value);
}

function formatTimestamp(value: bigint) {
  return new Date(Number(value)).toISOString().replace('T', ' ').slice(0, 16);
}
