import {
  ManagerIdList as ManagerList,
  TerminalMetricCard as MetricCard,
  TerminalPageHeader as PageHeader,
  TerminalState as PnlState,
} from '@/components/terminal/TerminalPanels';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import {
  formatOptionalQuoteAmount,
  formatQuoteAmount,
  formatTimestampMinute as formatTimestamp,
} from '@/lib/formatters';
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
      <PageHeader
        eyebrow="Assets"
        source="Indexed manager PnL"
        title="PnL"
        titleId="pnl-page-title"
      />
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
      <svg
        aria-label="Manager PnL chart"
        className="mt-4 h-56 w-full"
        role="img"
        viewBox="0 0 640 220"
      >
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
