import {
  ManagerIdList as ManagerList,
  TerminalKeyValue as KeyValue,
  TerminalMetricCard as MetricCard,
  TerminalPageHeader as PageHeader,
  TerminalState as PortfolioState,
} from '@/components/terminal/TerminalPanels';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import {
  formatPrice1e9,
  formatQuoteAmount,
  formatTimestampMinute as formatTimestamp,
} from '@/lib/formatters';
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
        titleId="portfolio-page-title"
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
        <MetricCard
          label="Wallet"
          value={walletLabel}
          helper="Wallet dUSDC balance not loaded in this lane"
        />
        <MetricCard
          label="Manager dUSDC"
          value={formatQuoteAmount(balance.totalManagerBalanceQuote)}
          helper="Held inside PredictManager"
        />
        <MetricCard
          label="Trading balance"
          value={formatQuoteAmount(balance.tradingBalanceQuote)}
          helper="Available manager quote balance"
        />
        <MetricCard
          label="Account value"
          value={formatQuoteAmount(balance.accountValueQuote)}
          helper="Indexed manager valuation"
        />
        <MetricCard
          label="Open positions"
          value={String(balance.openPositions)}
          helper="Manager-backed quantities"
        />
        <MetricCard
          label="Open exposure"
          value={formatQuoteAmount(balance.openExposureQuote)}
          helper="Indexed exposure"
        />
        <MetricCard
          label="Realized PnL"
          value={formatQuoteAmount(balance.realizedPnlQuote)}
          helper="Manager-level realized result"
        />
        <MetricCard
          label="Unrealized PnL"
          value={formatQuoteAmount(balance.unrealizedPnlQuote)}
          helper="Indexed estimate"
        />
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
                  {group.markValueQuote === null
                    ? 'Unavailable'
                    : formatQuoteAmount(group.markValueQuote)}
                </td>
                <td className="p-3 text-[#3f514b]">{formatQuoteAmount(group.realizedPnlQuote)}</td>
                <td className="p-3 text-[#3f514b]">
                  {formatQuoteAmount(group.unrealizedPnlQuote)}
                </td>
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
