import type { ReactNode } from 'react';
import { TxDigestLink } from '@/components/tx/TxDigestLink';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import type { ProtocolHistoryRecord } from '@/types/history';
import type { SuiAddress } from '@/types/predict';
import { useTransactionHistory } from './hooks/useTransactionHistory';

export function HistoryPage() {
  const wallet = useWalletStatus();
  const manager = usePredictManager();
  const managerId = manager.managerId ?? undefined;
  const owner = (manager.owner ?? wallet.accountAddress ?? null) as SuiAddress | null;
  const canLoadHistory = wallet.isConnected && manager.isReady && managerId !== undefined;
  const history = useTransactionHistory({
    enabled: canLoadHistory,
    managerId,
    owner,
  });

  let content;

  if (!wallet.isConnected) {
    content = (
      <HistoryState
        description="Connect a Sui Testnet wallet before loading indexed manager and LP activity."
        title="Connect wallet to view history"
      />
    );
  } else if (manager.isLoading || manager.isConfirming) {
    content = (
      <HistoryState
        description="Checking indexed manager discovery and confirming the selected PredictManager before loading history."
        title="Loading PredictManager"
      />
    );
  } else if (manager.requiresCreateManager) {
    content = (
      <HistoryState
        description="No PredictManager was found for this wallet. History appears after a manager exists and indexed events match it."
        title="No PredictManager found"
      />
    );
  } else if (manager.isAmbiguous) {
    content = (
      <HistoryState
        description="More than one manager matched the connected wallet. This read-only page will not choose a manager automatically."
        title="Ambiguous PredictManager"
      >
        <ManagerList managerIds={manager.matchingManagers.map((item) => item.managerId)} />
      </HistoryState>
    );
  } else if (manager.error !== null) {
    content = (
      <HistoryState
        description={manager.error.message}
        title="History manager lookup failed"
        tone="error"
      />
    );
  } else if (history.isLoading || history.isPending) {
    content = (
      <HistoryState
        description="Loading indexed binary, range, and LP activity feeds."
        title="Loading history"
      />
    );
  } else if (history.error !== null) {
    content = (
      <HistoryState description={history.error.message} title="History query failed" tone="error" />
    );
  } else if (history.data === undefined) {
    content = (
      <HistoryState
        description="History is idle because no ready manager is selected."
        title="History unavailable"
      />
    );
  } else if (history.data.isEmpty) {
    content = (
      <HistoryState
        description="No indexed mints, redeems, supplies, or withdrawals matched this manager and wallet yet."
        title="No history yet"
      />
    );
  } else {
    content = <HistorySuccess history={history.data} />;
  }

  return (
    <article aria-labelledby="history-page-title" className="space-y-5">
      <PageHeader eyebrow="Assets" source="Indexed transaction history" title="History" />
      {content}
    </article>
  );
}

function HistorySuccess({
  history,
}: {
  history: NonNullable<ReturnType<typeof useTransactionHistory>['data']>;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3" aria-label="History summary">
        <MetricCard helper="Matched indexed events" label="Total records" value={String(history.totalCount)} />
        <MetricCard
          helper="Newest indexed timestamp"
          label="Latest activity"
          value={history.latestTimestampMs === null ? 'Unavailable' : formatTimestamp(history.latestTimestampMs)}
        />
        <MetricCard
          helper="Digest links use existing event digests"
          label="Source"
          value="Indexed"
        />
      </section>

      <HistoryGroup
        records={history.feeds.positionMints}
        title="Binary Minted"
        total={history.countsByKind.BINARY_MINT}
      />
      <HistoryGroup
        records={history.feeds.positionRedeems}
        title="Binary Redeemed"
        total={history.countsByKind.BINARY_REDEEM}
      />
      <HistoryGroup
        records={history.feeds.rangeMints}
        title="Range Minted"
        total={history.countsByKind.RANGE_MINT}
      />
      <HistoryGroup
        records={history.feeds.rangeRedeems}
        title="Range Redeemed"
        total={history.countsByKind.RANGE_REDEEM}
      />
      <HistoryGroup
        records={history.feeds.lpSupplies}
        title="LP Supplies"
        total={history.countsByKind.LP_SUPPLY}
      />
      <HistoryGroup
        records={history.feeds.lpWithdrawals}
        title="LP Withdrawals"
        total={history.countsByKind.LP_WITHDRAW}
      />
    </div>
  );
}

function HistoryGroup({
  records,
  title,
  total,
}: {
  records: ProtocolHistoryRecord[];
  title: string;
  total: number;
}) {
  return (
    <section aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-title`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#17211d]" id={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>
          {title}
        </h2>
        <span className="border border-[#b8c6c0] bg-[#edf5f1] px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
          {total}
        </span>
      </div>
      {records.length === 0 ? (
        <div className="border border-[#d9dfdc] bg-[#fbfcfc] p-4 text-sm text-[#3f514b]">
          No indexed records for this action type.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#d9dfdc]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[#edf5f1] text-xs uppercase tracking-[0.12em] text-[#46635a]">
              <tr>
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Action</th>
                <th className="p-3 font-semibold">Market / Vault</th>
                <th className="p-3 font-semibold">Quantity</th>
                <th className="p-3 font-semibold">Value</th>
                <th className="p-3 font-semibold">Digest</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <HistoryRow key={`${record.digest}:${record.eventIndex ?? 0}`} record={record} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistoryRow({ record }: { record: ProtocolHistoryRecord }) {
  return (
    <tr className="border-t border-[#d9dfdc]">
      <td className="p-3 text-[#3f514b]">{formatTimestamp(record.timestampMs)}</td>
      <td className="p-3 font-semibold text-[#17211d]">{formatHistoryKind(record.kind)}</td>
      <td className="p-3 text-[#3f514b]">{historyMarketLabel(record)}</td>
      <td className="p-3 text-[#3f514b]">{historyQuantity(record)}</td>
      <td className="p-3 text-[#3f514b]">{historyValue(record)}</td>
      <td className="p-3">
        {record.digest === '' ? (
          <span className="text-[#64736e]">Unavailable</span>
        ) : (
          <TxDigestLink
            className="font-semibold text-[#176b5b] underline"
            digest={record.digest}
          />
        )}
      </td>
    </tr>
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
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]" id="history-page-title">
          {title}
        </h1>
      </div>
      <span className="w-fit border border-[#b8c6c0] bg-[#edf5f1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#315447]">
        {source}
      </span>
    </header>
  );
}

function HistoryState({
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

function historyMarketLabel(record: ProtocolHistoryRecord) {
  switch (record.kind) {
    case 'BINARY_MINT':
    case 'BINARY_REDEEM':
      return `${record.key.oracleId} ${record.key.direction} ${formatPrice1e9(
        record.key.strike1e9,
      )}`;
    case 'RANGE_MINT':
    case 'RANGE_REDEEM':
      return `${record.key.oracleId} ${formatPrice1e9(
        record.key.lowerStrike1e9,
      )}-${formatPrice1e9(record.key.higherStrike1e9)}`;
    case 'LP_SUPPLY':
    case 'LP_WITHDRAW':
      return 'Predict vault';
    case 'ORACLE_TRADE':
      return record.oracleId;
  }
}

function historyQuantity(record: ProtocolHistoryRecord) {
  switch (record.kind) {
    case 'BINARY_MINT':
    case 'BINARY_REDEEM':
    case 'RANGE_MINT':
    case 'RANGE_REDEEM':
      return formatQuoteAmount(record.quantityQuote);
    case 'LP_SUPPLY':
      return formatQuoteAmount(record.suppliedQuote);
    case 'LP_WITHDRAW':
      return formatQuoteAmount(record.withdrawnQuote);
    case 'ORACLE_TRADE':
      return record.quantityQuote === undefined ? 'Unavailable' : formatQuoteAmount(record.quantityQuote);
  }
}

function historyValue(record: ProtocolHistoryRecord) {
  switch (record.kind) {
    case 'BINARY_MINT':
    case 'RANGE_MINT':
      return formatQuoteAmount(record.costQuote);
    case 'BINARY_REDEEM':
    case 'RANGE_REDEEM':
      return formatQuoteAmount(record.payoutQuote);
    case 'LP_SUPPLY':
      return `${record.mintedPlpAtomic.toLocaleString()} PLP`;
    case 'LP_WITHDRAW':
      return `${record.burnedPlpAtomic.toLocaleString()} PLP`;
    case 'ORACLE_TRADE':
      return record.costQuote === undefined && record.payoutQuote === undefined
        ? 'Unavailable'
        : formatQuoteAmount(record.costQuote ?? record.payoutQuote ?? 0n);
  }
}

function formatHistoryKind(kind: ProtocolHistoryRecord['kind']) {
  switch (kind) {
    case 'BINARY_MINT':
      return 'Binary mint';
    case 'BINARY_REDEEM':
      return 'Binary redeem';
    case 'RANGE_MINT':
      return 'Range mint';
    case 'RANGE_REDEEM':
      return 'Range redeem';
    case 'LP_SUPPLY':
      return 'LP supply';
    case 'LP_WITHDRAW':
      return 'LP withdraw';
    case 'ORACLE_TRADE':
      return 'Oracle trade';
  }
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
