import { useState } from 'react';
import { ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import { predictDeploymentConfig } from '@/config/predict';
import { StatePanel, StateSkeletonGrid } from '@/components/states/StatePrimitives';
import {
  TerminalDatum,
  TerminalMetricCard,
  TerminalPanel,
} from '@/components/terminal/TerminalPanels';
import { useAskBounds } from '@/features/markets/hooks/useAskBounds';
import { useOracleState } from '@/features/markets/hooks/useOracleState';
import { usePredictManager } from '@/features/manager/hooks/usePredictManager';
import { useManagerSummary } from '@/features/portfolio/hooks/useManagerSummary';
import { usePositionsSummary } from '@/features/portfolio/hooks/usePositionsSummary';
import { useWalletStatus } from '@/features/wallet/useWalletStatus';
import { getOracleStatus } from '@/lib/oracle-status';
import {
  formatLifecycleLabel,
  formatObjectId,
  formatPrice1e9,
  formatQuoteAmount,
  formatSafeIsoTimestamp,
} from '@/lib/formatters';
import type { ObjectId } from '@/types/predict';
import type { OracleStateModel } from '@/types/oracle';
import { StrategyBuilder } from './StrategyBuilder';

export interface MarketDetailPageProps {
  nowMs?: number;
  oracleId?: string | null;
}

export function MarketDetailPage({ nowMs, oracleId }: MarketDetailPageProps = {}) {
  const [initialNowMs] = useState(() => Date.now());
  const effectiveNowMs = nowMs ?? initialNowMs;
  const parsedOracleId = parseOracleId(oracleId);
  const queryOracleId = parsedOracleId.ok
    ? parsedOracleId.oracleId
    : predictDeploymentConfig.predictObjectId;
  const queryEnabled = parsedOracleId.ok;
  const wallet = useWalletStatus();
  const manager = usePredictManager({
    enabled: queryEnabled,
  });
  const oracleStateQuery = useOracleState({
    enabled: queryEnabled,
    oracleId: queryOracleId,
  });
  const askBoundsQuery = useAskBounds({
    enabled: queryEnabled,
    oracleId: queryOracleId,
  });
  const managerId = manager.isReady ? manager.managerId : null;
  const managerSummaryQuery = useManagerSummary({
    enabled: queryEnabled && managerId !== null,
    managerId: managerId ?? undefined,
  });
  const positionsSummaryQuery = usePositionsSummary({
    enabled: queryEnabled && managerId !== null,
    managerId: managerId ?? undefined,
  });

  return (
    <article aria-labelledby="market-detail-title" className="space-y-5">
      <header className="border border-[#c8d3ce] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#446b5e]">
              PP-043 Market detail
            </p>
            <h1
              className="mt-2 text-3xl font-semibold tracking-normal text-[#17211d]"
              id="market-detail-title"
            >
              Market Detail / Strategy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#52615c]">
              Inspect one OracleSVI market, stage binary or range parameters, and open guarded
              simulation review only after wallet, manager, and funding checks pass.
            </p>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 xl:min-w-[360px]">
            <ContextPill label="Network" value={`Sui ${predictDeploymentConfig.network}`} />
            <ContextPill label="Quote" value={predictDeploymentConfig.quoteAsset.symbol} />
            <ContextPill
              label="Predict object"
              value={formatObjectId(predictDeploymentConfig.predictObjectId)}
            />
            <ContextPill
              label="Oracle"
              value={parsedOracleId.ok ? formatObjectId(parsedOracleId.oracleId) : 'Not selected'}
            />
          </div>
        </div>
      </header>

      <MarketDetailBody
        askBoundsQuery={askBoundsQuery}
        manager={manager}
        managerSummaryQuery={managerSummaryQuery}
        nowMs={effectiveNowMs}
        oracleId={oracleId}
        oracleStateQuery={oracleStateQuery}
        parsedOracleId={parsedOracleId}
        positionsSummaryQuery={positionsSummaryQuery}
        wallet={wallet}
      />
    </article>
  );
}

function MarketDetailBody({
  askBoundsQuery,
  manager,
  managerSummaryQuery,
  nowMs,
  oracleId,
  oracleStateQuery,
  parsedOracleId,
  positionsSummaryQuery,
  wallet,
}: {
  askBoundsQuery: ReturnType<typeof useAskBounds>;
  manager: ReturnType<typeof usePredictManager>;
  managerSummaryQuery: ReturnType<typeof useManagerSummary>;
  nowMs: number;
  oracleId: string | null | undefined;
  oracleStateQuery: ReturnType<typeof useOracleState>;
  parsedOracleId: ParseOracleIdResult;
  positionsSummaryQuery: ReturnType<typeof usePositionsSummary>;
  wallet: ReturnType<typeof useWalletStatus>;
}) {
  if (oracleId === null || oracleId === undefined || oracleId.trim() === '') {
    return (
      <StatePanel
        description="Select a market from Market Intelligence before preparing a binary or range strategy."
        headingLevel={2}
        label="Strategy builder empty state"
        title="Select a market first"
        tone="empty"
      />
    );
  }

  if (!parsedOracleId.ok) {
    return (
      <StatePanel
        description="The market detail route needs a 32-byte Sui object ID. No Predict server request was made."
        label="Invalid oracle route"
        title="Invalid oracle route"
        tone="blocked"
      />
    );
  }

  if (oracleStateQuery.isPending || oracleStateQuery.isLoading) {
    return (
      <StatePanel
        description="Loading focused OracleSVI state before the strategy builder is enabled."
        label="Market detail loading state"
        title="Loading market detail"
        tone="loading"
      >
        <StateSkeletonGrid count={4} label="Market detail skeleton loading" />
      </StatePanel>
    );
  }

  if (oracleStateQuery.error !== null) {
    return (
      <StatePanel
        description={oracleStateQuery.error.message}
        label="Market detail error state"
        title="Market detail failed to load"
        tone="error"
      />
    );
  }

  if (oracleStateQuery.data === undefined) {
    return (
      <StatePanel
        description="Oracle state is unavailable. Retry the market detail route before staging a strategy."
        label="Market detail empty state"
        title="Oracle state unavailable"
        tone="empty"
      />
    );
  }

  const managerSummary = managerSummaryQuery.data?.summary ?? null;
  const positionsSummary = positionsSummaryQuery.data ?? null;

  return (
    <div className="space-y-5">
      <MarketSnapshot
        isAskBoundsLoading={askBoundsQuery.isPending || askBoundsQuery.isLoading}
        nowMs={nowMs}
        oracleState={oracleStateQuery.data}
      />
      {askBoundsQuery.error === null ? null : (
        <StatePanel
          description={askBoundsQuery.error.message}
          label="Ask bounds warning"
          title="Ask bounds unavailable"
          tone="warning"
        />
      )}
      {managerSummaryQuery.error === null ? null : (
        <StatePanel
          description={managerSummaryQuery.error.message}
          label="Manager summary warning"
          title="Manager summary unavailable"
          tone="warning"
        />
      )}
      {positionsSummaryQuery.error === null ? null : (
        <StatePanel
          description={positionsSummaryQuery.error.message}
          label="Positions summary warning"
          title="Positions summary unavailable"
          tone="warning"
        />
      )}
      <StrategyBuilder
        askBounds={askBoundsQuery.data ?? oracleStateQuery.data.askBounds}
        key={oracleStateQuery.data.oracle.oracleId}
        manager={manager}
        managerSummary={managerSummary}
        nowMs={nowMs}
        oracleState={oracleStateQuery.data}
        positionsSummary={positionsSummary}
        walletStatus={wallet}
      />
    </div>
  );
}

function MarketSnapshot({
  isAskBoundsLoading,
  nowMs,
  oracleState,
}: {
  isAskBoundsLoading: boolean;
  nowMs: number;
  oracleState: OracleStateModel;
}) {
  const status = getOracleStatus({ nowMs, oracleState });
  const latestPrice = oracleState.latestPrice;

  return (
    <section aria-label="Market detail snapshot" className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <TerminalPanel title="OracleSVI market snapshot">
        <div className="grid gap-3 md:grid-cols-2">
          <TerminalMetricCard
            helper="Market detail keeps the protocol object visible before strategy staging."
            label="Oracle"
            value={formatObjectId(oracleState.oracle.oracleId)}
          />
          <TerminalMetricCard
            helper="Lifecycle controls whether mint and range mint are allowed."
            label="Lifecycle"
            value={formatLifecycleLabel(oracleState.oracle.lifecycleStatus)}
          />
          <TerminalMetricCard
            helper="Freshness is derived from the existing oracle status utility."
            label="Freshness"
            value={status.freshness.aggregateStatus}
          />
          <TerminalMetricCard
            helper="Ask-bound internals remain TODO VERIFY until server fields are confirmed."
            label="Ask bounds"
            value={isAskBoundsLoading ? 'Loading' : oracleState.askBounds.status}
          />
        </div>
      </TerminalPanel>

      <TerminalPanel title="Price and strike context">
        <dl className="grid gap-3 md:grid-cols-2">
          <TerminalDatum
            label="Spot"
            value={latestPrice === null ? 'Unavailable' : formatPrice1e9(latestPrice.spot1e9)}
          />
          <TerminalDatum
            label="Forward"
            value={latestPrice === null ? 'Unavailable' : formatPrice1e9(latestPrice.forward1e9)}
          />
          <TerminalDatum
            label="Min strike"
            value={formatPrice1e9(oracleState.oracle.minStrike1e9)}
          />
          <TerminalDatum label="Tick size" value={formatPrice1e9(oracleState.oracle.tickSize1e9)} />
          <TerminalDatum
            label="Expiry"
            value={formatSafeIsoTimestamp(oracleState.oracle.expiryMs)}
          />
          <TerminalDatum label="Trade quantity unit" value={formatQuoteAmount(1_000_000n)} />
        </dl>
      </TerminalPanel>
    </section>
  );
}

function ContextPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dfdc] bg-[#fbfcfc] px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64736e]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#17211d]">{value}</dd>
    </div>
  );
}

type ParseOracleIdResult =
  | {
      ok: false;
    }
  | {
      ok: true;
      oracleId: ObjectId;
    };

function parseOracleId(oracleId: string | null | undefined): ParseOracleIdResult {
  const result = ObjectIdSchema.safeParse(oracleId);

  if (!result.success) {
    return { ok: false };
  }

  return {
    ok: true,
    oracleId: result.data as ObjectId,
  };
}
