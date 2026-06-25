import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DemoModePage } from '@/features/demo/DemoModePage';

describe('DemoModePage', () => {
  it('renders explicit offline demo labels and proof boundaries', () => {
    render(<DemoModePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Offline Demo' })).toBeInTheDocument();
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    expect(screen.getAllByText('Offline fixture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not live Testnet proof').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No wallet signature will be requested').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Demo mode proof boundary')).toHaveTextContent(
      'never displays a fabricated transaction digest',
    );
  });

  it('steps through the judge walkthrough and resets safely', () => {
    render(<DemoModePage />);

    expect(screen.getByRole('heading', { name: 'Oracle readiness' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByRole('heading', { name: 'Strategy preview' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Vault' }));
    expect(screen.getByRole('heading', { name: 'Vault and PLP' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.getByRole('heading', { name: 'Oracle readiness' })).toBeInTheDocument();
  });

  it('offers route jumps without requesting signatures or rendering explorer proof', () => {
    const onNavigate = vi.fn();

    render(<DemoModePage onNavigate={onNavigate} />);

    const proofRoutes = screen.getByLabelText('Jump to live proof routes');
    fireEvent.click(within(proofRoutes).getByRole('button', { name: 'Start Live Demo Guide' }));

    expect(onNavigate).toHaveBeenCalledWith('/judge-demo');

    fireEvent.click(within(proofRoutes).getByRole('button', { name: 'Open live markets' }));

    expect(onNavigate).toHaveBeenCalledWith('/markets');
    expect(
      screen.queryByRole('button', { name: /request wallet signature/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view transaction/i })).not.toBeInTheDocument();
  });

  it('renders an honest disabled state when judge mode is disabled', () => {
    const onNavigate = vi.fn();

    render(<DemoModePage flags={{ enableJudgeMode: false }} onNavigate={onNavigate} />);

    expect(screen.getByRole('alert', { name: /Demo mode disabled/i })).toBeInTheDocument();
    expect(screen.getByText(/disabled by the public runtime feature flag/i)).toBeInTheDocument();
    expect(screen.queryByText('Offline fixture')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(onNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps curated fixture content inside clearly labeled panels', () => {
    render(<DemoModePage />);

    const fixtureSnapshot = screen.getByLabelText('Curated fixture snapshot');

    expect(
      within(fixtureSnapshot).getByRole('heading', { name: 'Oracle fixture' }),
    ).toBeInTheDocument();
    expect(within(fixtureSnapshot).getByText('BTC weekly expiry')).toBeInTheDocument();
    expect(
      within(fixtureSnapshot).getByRole('heading', { name: 'Manager fixture' }),
    ).toBeInTheDocument();
    expect(within(fixtureSnapshot).getByText('1,250.00 dUSDC')).toBeInTheDocument();
    expect(
      within(fixtureSnapshot).getByRole('heading', { name: 'Vault fixture' }),
    ).toBeInTheDocument();
    expect(within(fixtureSnapshot).getByText('Requires live check')).toBeInTheDocument();
  });
});
