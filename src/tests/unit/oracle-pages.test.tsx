import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { OracleStatusPage } from '@/features/oracle/OracleStatusPage';
import { SVISurfacePage } from '@/features/oracle/SVISurfacePage';
import type { OracleReadClient } from '@/integrations/deepbook-predict/api/oracles';
import type { ObjectId } from '@/types/predict';

const predictId = predictDeploymentConfig.predictObjectId;
const oracleId = '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
const oracleCapId = '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817';
const sender = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c';
const nowMs = 1_781_635_255_000;

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });

  function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return TestQueryProvider;
}

function createOracleClient(overrides: Partial<OracleReadClient> = {}): OracleReadClient {
  return {
    fetchOracleAskBoundsDto: vi.fn(),
    fetchOracleStateDto: vi.fn(),
    ...overrides,
  };
}

function renderWithQueryClient(ui: ReactNode) {
  const Wrapper = createTestWrapper();

  return render(<Wrapper>{ui}</Wrapper>);
}

function oracleStateDto({
  askBounds = null,
  includePrice = true,
  includeSvi = true,
  lifecycleStatus = 'active',
  priceTimestampMs = 1_781_635_254_000,
  settledAt = null,
  settlementPrice = null,
  sviTimestampMs = 1_781_635_250_000,
}: {
  askBounds?: Record<string, unknown> | null;
  includePrice?: boolean;
  includeSvi?: boolean;
  lifecycleStatus?: string;
  priceTimestampMs?: number;
  settledAt?: number | null;
  settlementPrice?: number | null;
  sviTimestampMs?: number;
} = {}) {
  return {
    ask_bounds: askBounds,
    latest_price: includePrice
      ? {
          checkpoint: 349_222_343,
          checkpoint_timestamp_ms: priceTimestampMs,
          digest: `price-digest-${priceTimestampMs}`,
          event_digest: `price-event-${priceTimestampMs}`,
          event_index: 0,
          forward: 65_500_000_000_000,
          onchain_timestamp: priceTimestampMs,
          oracle_id: oracleId,
          package: predictDeploymentConfig.packageId,
          sender,
          spot: 65_250_000_000_000,
          tx_index: 0,
        }
      : null,
    latest_svi: includeSvi
      ? {
          a: 1_100_000_000,
          b: 2_200_000_000,
          checkpoint: 349_222_344,
          checkpoint_timestamp_ms: sviTimestampMs,
          digest: `svi-digest-${sviTimestampMs}`,
          event_digest: `svi-event-${sviTimestampMs}`,
          event_index: 1,
          m: 400_000_000,
          m_negative: false,
          onchain_timestamp: sviTimestampMs,
          oracle_id: oracleId,
          package: predictDeploymentConfig.packageId,
          rho: 300_000_000,
          rho_negative: true,
          sender,
          sigma: 500_000_000,
          tx_index: 1,
        }
      : null,
    oracle: {
      activated_at: 1_781_634_686_445,
      created_checkpoint: 349_219_640,
      expiry: 1_781_641_800_000,
      min_strike: 50_000_000_000_000,
      oracle_cap_id: oracleCapId,
      oracle_id: oracleId,
      predict_id: predictId,
      settlement_price: settlementPrice,
      settled_at: settledAt,
      status: lifecycleStatus,
      tick_size: 1_000_000_000,
      underlying_asset: 'BTC',
    },
  };
}

describe('oracle page components', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders active fresh oracle status with price, SVI, and live tape state', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });

    renderWithQueryClient(
      <OracleStatusPage
        client={client}
        nowMs={nowMs}
        oracleId={oracleId}
        pollIntervalMs={60_000}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Oracle Status' })).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('65,250')).toBeInTheDocument();
    expect(screen.getByText('65,500')).toBeInTheDocument();
    expect(screen.getByText('PREDICT_SERVER_POLLING')).toBeInTheDocument();

    const tradeability = screen.getByRole('region', { name: 'Tradeability explanation' });
    expect(within(tradeability).getByText('Mint is available')).toBeInTheDocument();
    expect(within(tradeability).getByText('Range mint is available')).toBeInTheDocument();
    expect(client.fetchOracleStateDto).toHaveBeenCalledWith(oracleId);
  });

  it('renders the SVI surface explorer from current verified fields only', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });

    renderWithQueryClient(
      <SVISurfacePage client={client} nowMs={nowMs} oracleId={oracleId} pollIntervalMs={60_000} />,
    );

    expect(
      await screen.findByRole('heading', { name: 'SVI Surface Explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('SVI parameters present')).toBeInTheDocument();
    expect(screen.getByText('1.1')).toBeInTheDocument();
    expect(screen.getByText('-0.3')).toBeInTheDocument();
    expect(screen.getByText('Forward minus spot')).toBeInTheDocument();
    expect(screen.getByText('Surface derivation unavailable')).toBeInTheDocument();
    expect(screen.getByText(/TODO VERIFY SVI visualization math/i)).toBeInTheDocument();
  });

  it('shows stale oracle warnings and blocked mint status', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(
        oracleStateDto({
          priceTimestampMs: nowMs - 60_000,
          sviTimestampMs: nowMs - 90_000,
        }),
      ),
    });

    renderWithQueryClient(
      <OracleStatusPage
        client={client}
        nowMs={nowMs}
        oracleId={oracleId}
        pollIntervalMs={60_000}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Oracle Status' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('STALE').length).toBeGreaterThan(0));
    expect(screen.getByText('Mint is blocked')).toBeInTheDocument();
    expect(screen.getAllByText(/oracle stale/i).length).toBeGreaterThan(0);
  });

  it('shows settled oracle settlement context and redeem availability', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(
        oracleStateDto({
          lifecycleStatus: 'settled',
          settledAt: 1_781_641_900_000,
          settlementPrice: 66_000_000_000_000,
        }),
      ),
    });

    renderWithQueryClient(
      <OracleStatusPage
        client={client}
        nowMs={1_781_641_901_000}
        oracleId={oracleId}
        pollIntervalMs={60_000}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Oracle Status' })).toBeInTheDocument();
    expect(screen.getAllByText('Settled').length).toBeGreaterThan(0);
    expect(screen.getByText('66,000')).toBeInTheDocument();
    expect(screen.getByText(/Settled OracleSVI/i)).toBeInTheDocument();
    expect(screen.getByText('Redeem is available')).toBeInTheDocument();
    expect(screen.getAllByText(/settled redeem available/i).length).toBeGreaterThan(0);
  });

  it('renders missing price and SVI fields as unavailable without a fabricated surface', async () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(
        oracleStateDto({
          includePrice: false,
          includeSvi: false,
        }),
      ),
    });

    renderWithQueryClient(
      <SVISurfacePage client={client} nowMs={nowMs} oracleId={oracleId} pollIntervalMs={60_000} />,
    );

    expect(
      await screen.findByRole('heading', { name: 'SVI Surface Explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/SVI parameters unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Latest price unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('Surface derivation unavailable')).toBeInTheDocument();
    expect(screen.getAllByText(/TODO VERIFY/i).length).toBeGreaterThan(0);
  });

  it('renders no-oracle empty states without calling the oracle client', () => {
    const client = createOracleClient({
      fetchOracleStateDto: vi.fn().mockResolvedValue(oracleStateDto()),
    });

    renderWithQueryClient(
      <div>
        <OracleStatusPage client={client} />
        <SVISurfacePage client={client} />
      </div>,
    );

    expect(screen.getAllByRole('heading', { name: 'No oracle selected' })).toHaveLength(2);
    expect(client.fetchOracleStateDto).not.toHaveBeenCalled();
  });
});
