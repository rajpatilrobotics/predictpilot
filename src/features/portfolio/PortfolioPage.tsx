import type { ReactNode } from 'react';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import { useManagerSummary } from './hooks/useManagerSummary';
import { usePositionsSummary } from './hooks/usePositionsSummary';
import type {
  BinaryPositionGroupModel,
  ManagerSummaryPortfolioModel,
  NormalizedManagerPositionsSummaryModel,
  RangePositionGroupModel,
} from './lib/portfolio-selectors';

export function PortfolioPage() {
  const wallet = useWalletStatus();
  const manager = usePredictManager();
  const managerId = manager.managerId ?? undefined;
  const canLoadManagerData = wallet.isConnected && manager.isReady && managerId !== undefined;
  const managerSummary = useManagerSummary({
    enabled: canLoadManagerData,
    managerId,
  });
  const positionsSummary = usePositionsSummary({
    enabled: canLoadManagerData,
    managerId,
  });

  let content;

  if (!wallet.isConnected) {
    content = (
      <PortfolioState
        description="Connect a Sui Testnet wallet before loading manager-held balances and positions."
        title="Connect wallet to view portfolio"
      />
    );
  } else if (manager.isLoading || manager.isConfirming) {
    content = (
      <PortfolioState
        description="Checking indexed manager discovery and confirming the selected PredictManager before loading portfolio data."
        title="Loading PredictManager"
      />
    );
  } else if (manager.requiresCreateManager) {
    content = (
      <PortfolioState
        description="No PredictManager was found for this wallet. Portfolio data appears after a manager is created and indexed."
        title="No PredictManager found"
      />
    );
  } else if (manager.isAmbiguous) {
    content = (
      <PortfolioState
        description="More than one manager matched the connected wallet. This read-only page will not choose a manager automatically."
        title="Ambiguous PredictManager"
      >
        <ManagerList managerIds={manager.matchingManagers.map((item) => item.managerId)} />
      </PortfolioState>
    );
  } else if (manager.error !== null) {
    content = (
      <PortfolioState
        description={manager.error.message}
        tone="error"
        title="Portfolio manager lookup failed"
      />
    );
  } else if (
    managerSummary.isLoading ||
    managerSummary.isPending ||
    positionsSummary.isLoading ||
    positionsSummary.isPending
  ) {
    content = (
      <PortfolioState
        description="Loading indexed manager summary, manager balances, and manager-backed position quantities."
        title="Loading portfolio"
      />
    );
  } else if (managerSummary.error !== null) {
    content = (
      <PortfolioState
        description={managerSummary.error.message}
        tone="error"
        title="Manager summary failed"
      />
    );
  } else if (positionsSummary.error !== null) {
    content = (
      <PortfolioState
        description={positionsSummary.error.message}
        tone="error"
        title="Positions summary failed"
      />
    );
  } else if (managerSummary.data === undefined || positionsSummary.data === undefined) {
    content = (
      <PortfolioState
        description="Portfolio queries are idle because no ready manager is selected."
        title="Portfolio unavailable"
      />
    );
  } else {
    content = (
      <PortfolioSuccess
        managerSummary={managerSummary.data}
        positionsSummary={positionsSummary.data}
        walletLabel={wallet.shortAddress ?? wallet.accountAddress ?? 'Connected wallet'}
      />
    );
  }

  return (
    <article aria-labelledby="portfolio-page-title" className="space-y-5">
      <PageHeader
        eyebrow="Assets"
        source="Indexed manager summary"
        title="Portfolio"
      />
      {content}
    </article>
  );
}

function PortfolioSuccess({
  managerSummary,
  positionsSummary,
  walletLabel,
}: {
  managerSummary: ManagerSummaryPortfolioModel;
  positionsSummary: NormalizedManagerPositionsSummaryModel;
  walletLabel: string;
}) {
  const balance = managerSummary.balanceSummary;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio summary">
        <MetricCard label="Wallet" value={walletLabel} helper="Wallet dUSDC balance not loaded in this lane" />
        <MetricCard label="Manager dUSDC" value={formatQuoteAmount(balance.totalManagerBalanceQuote)} helper="Held inside PredictManager" />
        <MetricCard label="Trading balance" value={formatQuoteAmount(balance.tradingBalanceQuote)} helper="Available manager quote balance" />
        <MetricCard label="Account value" value={formatQuoteAmount(balance.accountValueQuote)} helper="Indexed manager valuation" />
        <MetricCard label="Open positions" value={String(balance.openPositions)} helper="Manager-backed quantities" />
        <MetricCard label="Open exposure" value={formatQuoteAmount(balance.openExposureQuote)} helper="Indexed exposure" />
        <MetricCard label="Realized PnL" value={formatQuoteAmount(balance.realizedPnlQuote)} helper="Manager-level realized result" />
        <MetricCard label="Unrealized PnL" value={formatQuoteAmount(balance.unrealizedPnlQuote)} helper="Indexed estimate" />
      </section>

      <section className="border border-[#d9dfdc] bg-[#fbfcfc] p-4" aria-label="Manager identity">
        <div className="grid gap-3 md:grid-cols-2">
          <KeyValue label="Connected wallet" value={walletLabel} />
          <KeyValue label="PredictManager" value={balance.managerId} />
          <KeyValue label="Manager owner" value={balance.owner} />
          <KeyValue label="Wallet balance source" value="Not queried by PP-046" />
        </div>
      </section>

      {positionsSummary.isEmpty ? (
        <PortfolioState
          description="No binary or range positions are currently indexed for this manager."
          title="No open positions"
        />
      ) : (
        <div className="space-y-5">
          <BinaryPositionsTable groups={positionsSummary.binaryGroups} />
          <RangePositionsTable groups={positionsSummary.rangeGroups} />
        </div>
      )}
    </div>
  );
}

function BinaryPositionsTable({ groups }: { groups: BinaryPositionGroupModel[] }) {
  if (groups.length === 0) {
    return (
      <PortfolioState
        description="No binary position quantities are indexed for this manager."
        title="No binary positions"
      />
    );
  }

  return (
    <section aria-labelledby="binary-positions-title" className="space-y-3">
      <h2 className="text-lg font-semibold text-[#17211d]" id="binary-positions-title">
        Binary positions
      </h2>
      <div className="overflow-x-auto border border-[#d9dfdc]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#edf5f1] text-xs uppercase tracking-[0.12em] text-[#46635a]">
            <tr>
              <th className="p-3 font-semibold">Oracle</th>
              <th className="p-3 font-semibold">Expiry</th>
              <th className="p-3 font-semibold">Directions</th>
              <th className="p-3 font-semibold">Strikes</th>
              <th className="p-3 font-semibold">Open qty</th>
              <th className="p-3 font-semibold">Mark value</th>
              <th className="p-3 font-semibold">Realized PnL</th>
              <th className="p-3 font-semibold">Unrealized PnL</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr className="border-t border-[#d9dfdc]" key={group.groupKey}>
                <td className="p-3 font-semibold text-[#17211d]">{group.underlyingAsset}</td>
                <td className="p-3 text-[#3f514b]">{formatTimestamp(group.expiryMs)}</td>
                <td className="p-3 text-[#3f514b]">{group.directions.join(', ')}</td>
                <td className="p-3 text-[#3f514b]">
                  {group.strikes1e9.map(formatPrice1e9).join(', ')}
                </td>
                <td className="p-3 text-[#3f514b]">{formatQuoteAmount(group.openQuantityQuote)}</td>
                <td className="p-3 text-[#3f514b]">
                  {group.markValueQuote === null ? 'Unavailable' : formatQuoteAmount(group.markValueQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">{formatQuoteAmount(group.realizedPnlQuote)}</td>
                <td className="p-3 text-[#3f514b]">{formatQuoteAmount(group.unrealizedPnlQuote)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RangePositionsTable({ groups }: { groups: RangePositionGroupModel[] }) {
  if (groups.length === 0) {
    return (
      <PortfolioState
        description="No range position quantities are indexed for this manager."
        title="No range positions"
      />
    );
  }

  return (
    <section aria-labelledby="range-positions-title" className="space-y-3">
      <h2 className="text-lg font-semibold text-[#17211d]" id="range-positions-title">
        Range positions
      </h2>
      <div className="overflow-x-auto border border-[#d9dfdc]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#edf5f1] text-xs uppercase tracking-[0.12em] text-[#46635a]">
            <tr>
              <th className="p-3 font-semibold">Oracle</th>
              <th className="p-3 font-semibold">Expiry</th>
              <th className="p-3 font-semibold">Ranges</th>
              <th className="p-3 font-semibold">Open qty</th>
              <th className="p-3 font-semibold">Rows</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr className="border-t border-[#d9dfdc]" key={group.groupKey}>
                <td className="p-3 font-semibold text-[#17211d]">{group.oracleId}</td>
                <td className="p-3 text-[#3f514b]">{formatTimestamp(group.expiryMs)}</td>
                <td className="p-3 text-[#3f514b]">
                  {group.positions
                    .map(
                      (position) =>
                        `${formatPrice1e9(position.key.lowerStrike1e9)}-${formatPrice1e9(
                          position.key.higherStrike1e9,
                        )}`,
                    )
                    .join(', ')}
                </td>
                <td className="p-3 text-[#3f514b]">
                  {formatQuoteAmount(group.totalQuantityQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">{group.positionCount}</td>
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
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]" id="portfolio-page-title">
          {title}
        </h1>
      </div>
      <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
        {source}
      </span>
    </header>
  );
}

function PortfolioState({
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

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-[#64736e]">{label}</p>
      <p className="mt-1 break-all font-semibold text-[#17211d]">{value}</p>
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

function formatQuoteAmount(value: bigint) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = absolute % 1_000_000n;
  const fractionText = fraction.toString().padStart(6, '0').replace(/0+$/, '');

  return `${sign}${whole.toLocaleString()}${fractionText === '' ? '' : `.${fractionText}`} dUSDC`;
}

function formatPrice1e9(value: bigint) {
  const whole = value / 1_000_000_000n;
  const fraction = value % 1_000_000_000n;
  const cents = (fraction / 10_000_000n).toString().padStart(2, '0');

  return `${whole.toLocaleString()}.${cents}`;
}

function formatTimestamp(value: bigint) {
  return new Date(Number(value)).toISOString().replace('T', ' ').slice(0, 16);
}
