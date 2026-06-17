import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { VaultPage } from '@/features/vault/VaultPage';
import type { VaultReadClient } from '@/integrations/deepbook-predict/api/vault';
import { HttpClientError } from '@/lib/http';
import type { SuiAddress } from '@/types/predict';

const predictId = predictDeploymentConfig.predictObjectId;
const quoteAsset = 'e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';
const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;

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

function createVaultClient(overrides: Partial<VaultReadClient> = {}): VaultReadClient {
  return {
    fetchVaultPerformanceDto: vi.fn().mockResolvedValue(performanceDto()),
    fetchVaultSummaryDto: vi.fn().mockResolvedValue(vaultSummaryDto()),
    ...overrides,
  };
}

function vaultSummaryDto(overrides: Record<string, unknown> = {}) {
  return {
    available_liquidity: 1_013_621_323_890,
    available_withdrawal: 1_013_621_323_890,
    max_payout_utilization: 0.0020975390715985472,
    net_deposits: 1_013_136_152_701,
    plp_share_price: 1.0018485537482182,
    plp_total_supply: 1_013_114_841_700,
    predict_id: predictId,
    quote_assets: [quoteAsset],
    total_max_payout: 2_130_579_304,
    total_mtm: 764_264_256,
    total_supplied: 1_072_609_144_409,
    total_withdrawn: 59_472_991_708,
    utilization: 0.0007524123298187235,
    vault_balance: 1_015_751_903_194,
    vault_value: 1_014_987_638_938,
    ...overrides,
  };
}

function performanceDto(points = performancePoints()) {
  return {
    points,
    predict_id: predictId,
    range: 'ALL',
  };
}

function performancePoints() {
  return [
    {
      share_price: 1,
      timestamp_ms: 1_776_715_922_850,
      total_shares: 1_000_000_000_000,
      vault_value: 1_000_000_000_000,
    },
    {
      share_price: 1.01,
      timestamp_ms: 1_776_716_922_850,
      total_shares: 1_010_000_000_000,
      vault_value: 1_020_100_000_000,
    },
  ];
}

function renderVaultPage({
  client = createVaultClient(),
  currentNetwork = 'testnet',
  walletDusdcBalanceQuote = 2_000_000n,
  walletPlpBalanceAtomic = 2_000_000n,
}: {
  client?: VaultReadClient;
  currentNetwork?: string | null;
  walletDusdcBalanceQuote?: bigint | null;
  walletPlpBalanceAtomic?: bigint | null;
} = {}) {
  return render(
    <VaultPage
      currentNetwork={currentNetwork}
      readClient={client}
      sender={sender}
      walletDusdcBalanceQuote={walletDusdcBalanceQuote}
      walletPlpBalanceAtomic={walletPlpBalanceAtomic}
    />,
    { wrapper: createTestWrapper() },
  );
}

describe('VaultPage', () => {
  it('renders loading states for the summary and performance panels', () => {
    const never = new Promise<never>(() => undefined);
    const client = createVaultClient({
      fetchVaultPerformanceDto: vi.fn().mockReturnValue(never),
      fetchVaultSummaryDto: vi.fn().mockReturnValue(never),
    });

    renderVaultPage({ client });

    expect(screen.getByRole('status', { name: /Vault summary loading/i })).toBeInTheDocument();
    expect(screen.getByText(/The vault takes the opposite side of every trade/i)).toBeInTheDocument();
  });

  it('renders populated vault metrics, PLP ownership, and performance series', async () => {
    const client = createVaultClient();

    renderVaultPage({ client });

    expect(await screen.findByRole('status', { name: /Vault summary loaded/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vault / PLP' })).toBeInTheDocument();
    expect(screen.getByText(/PLP represents LP shares in the shared vault/i)).toBeInTheDocument();
    expect(screen.getByText('Vault value')).toBeInTheDocument();
    expect(screen.getByText('1,014,987.638938 DUSDC')).toBeInTheDocument();
    expect(screen.getByText('Available liquidity')).toBeInTheDocument();
    expect(screen.getAllByText('1,013,621.32389 DUSDC').length).toBeGreaterThan(0);
    expect(screen.getByText('PLP ownership')).toBeInTheDocument();
    expect(screen.getByText('1,013,114.8417 PLP')).toBeInTheDocument();
    expect(screen.getByText(/Share price 1.001849 DUSDC/i)).toBeInTheDocument();
    expect(screen.getByText('Max payout')).toBeInTheDocument();
    expect(screen.getAllByText('2,130.579304 DUSDC').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Vault value performance chart/i })).toBeInTheDocument();
    expect(screen.getByText('Points')).toBeInTheDocument();
    expect(client.fetchVaultSummaryDto).toHaveBeenCalledWith(predictId);
    expect(client.fetchVaultPerformanceDto).toHaveBeenCalledWith(predictId, 'ALL');
  });

  it('renders empty performance and zero PLP states without treating them as errors', async () => {
    const client = createVaultClient({
      fetchVaultPerformanceDto: vi.fn().mockResolvedValue(performanceDto([])),
      fetchVaultSummaryDto: vi.fn().mockResolvedValue(
        vaultSummaryDto({
          plp_total_supply: 0,
        }),
      ),
    });

    renderVaultPage({
      client,
      walletPlpBalanceAtomic: 0n,
    });

    expect(await screen.findByText('No performance points yet')).toBeInTheDocument();
    expect(screen.getAllByText('0 PLP').length).toBeGreaterThan(0);
    expect(screen.getByText('No PLP position yet. Supply DUSDC to the vault to mint PLP shares.')).toBeInTheDocument();
  });

  it('renders safe summary and performance error states', async () => {
    const summaryFailureClient = createVaultClient({
      fetchVaultSummaryDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'http-status',
          message: 'Predict server unavailable',
          status: 503,
          url: `https://predict-server.testnet.mystenlabs.com/predicts/${predictId}/vault/summary`,
        }),
      ),
    });

    const { unmount } = renderVaultPage({ client: summaryFailureClient });

    expect(await screen.findByText('Predict server unavailable')).toBeInTheDocument();
    unmount();

    const performanceFailureClient = createVaultClient({
      fetchVaultPerformanceDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'timeout',
          message: 'Predict server timed out',
          url: `https://predict-server.testnet.mystenlabs.com/predicts/${predictId}/vault/performance`,
        }),
      ),
    });

    renderVaultPage({ client: performanceFailureClient });

    expect(await screen.findByText('Predict server unavailable')).toBeInTheDocument();
  });

  it('blocks LP preparation when vault state is missing', async () => {
    const summaryFailureClient = createVaultClient({
      fetchVaultSummaryDto: vi.fn().mockRejectedValue(
        new HttpClientError({
          kind: 'http-status',
          message: 'Predict server unavailable',
          status: 503,
          url: `https://predict-server.testnet.mystenlabs.com/predicts/${predictId}/vault/summary`,
        }),
      ),
    });

    renderVaultPage({ client: summaryFailureClient });

    expect(await screen.findByText('Predict server unavailable')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Supply amount'), { target: { value: '1.5' } });

    expect(screen.getByText('Vault state required')).toBeInTheDocument();
    expect(
      screen.getByText('Refresh the vault summary before preparing vault LP actions.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Preparing unsigned supply preview/i)).not.toBeInTheDocument();
  });

  it('prepares supply as an unsigned preview and keeps exact PLP output simulation-gated', async () => {
    renderVaultPage();

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Supply amount'), { target: { value: '1.5' } });

    expect(await screen.findByText(/Supply preparation ready/i)).toBeInTheDocument();
    expect(screen.getByText('Exact PLP shares out require simulation or onchain confirmation.')).toBeInTheDocument();
    expect(screen.getByText('SUPPLY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supply signing not wired' })).toBeDisabled();
  });

  it('blocks supply preparation when wallet DUSDC is insufficient', async () => {
    renderVaultPage({ walletDusdcBalanceQuote: 1n });

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Supply amount'), { target: { value: '1.5' } });

    await waitFor(() =>
      expect(
        screen.getAllByText('The connected wallet does not have enough DUSDC for this action.')
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it('prepares withdraw as an unsigned preview and keeps exact DUSDC output simulation-gated', async () => {
    renderVaultPage();

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Burn PLP amount'), { target: { value: '1.5' } });

    expect(await screen.findByText(/Withdraw preparation ready/i)).toBeInTheDocument();
    expect(screen.getByText('Exact DUSDC returned requires simulation or onchain confirmation.')).toBeInTheDocument();
    expect(screen.getByText('WITHDRAW')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw signing not wired' })).toBeDisabled();
  });

  it('blocks withdraw preparation when wallet PLP is insufficient', async () => {
    renderVaultPage({ walletPlpBalanceAtomic: 1n });

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Burn PLP amount'), { target: { value: '1.5' } });

    await waitFor(() =>
      expect(
        screen.getAllByText('The connected wallet does not have enough PLP for this withdrawal.')
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it('blocks withdraw preparation when vault withdrawal is unavailable', async () => {
    const client = createVaultClient({
      fetchVaultSummaryDto: vi.fn().mockResolvedValue(
        vaultSummaryDto({
          available_withdrawal: 0,
        }),
      ),
    });

    renderVaultPage({ client });

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Burn PLP amount'), { target: { value: '1.5' } });

    await waitFor(() =>
      expect(screen.getAllByText('Vault withdrawal is currently unavailable.').length).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText(
        'Withdrawals depend on current vault value and max payout coverage. Try a smaller amount later.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('blocks LP preparation on the wrong network before preparing a PTB preview', async () => {
    renderVaultPage({ currentNetwork: 'mainnet' });

    await screen.findByRole('status', { name: /Vault summary loaded/i });
    fireEvent.change(screen.getByLabelText('Supply amount'), { target: { value: '1.5' } });

    expect(screen.getByText('Wrong network: mainnet')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong network');
    expect(screen.getByText('Switch to testnet before preparing vault LP actions.')).toBeInTheDocument();
  });
});
