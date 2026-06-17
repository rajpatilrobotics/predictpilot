import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  InlineStateNotice,
  StatePanel,
  StateSkeletonGrid,
} from '@/components/states/StatePrimitives';

describe('state primitives', () => {
  it('renders loading and empty panels as polite status regions', () => {
    render(
      <StatePanel
        description="Loading route data without leaving a blank screen."
        label="Custom loading state"
        title="Loading dashboard"
        tone="loading"
      >
        <StateSkeletonGrid count={2} label="Dashboard loading skeleton" />
      </StatePanel>,
    );

    expect(screen.getByRole('status', { name: 'Custom loading state' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByRole('status', { name: 'Dashboard loading skeleton' })).toBeInTheDocument();
  });

  it('renders blocking and error panels as assertive alerts', () => {
    render(
      <StatePanel
        description="Switch to Sui Testnet before signing."
        title="Wrong network"
        tone="blocked"
      />,
    );

    expect(screen.getByRole('alert', { name: 'Wrong network' })).toHaveAttribute(
      'aria-live',
      'assertive',
    );
  });

  it('renders inline notices with compact status and alert roles', () => {
    const { rerender } = render(
      <InlineStateNotice label="Preview ready" tone="success">
        Simulation ready.
      </InlineStateNotice>,
    );

    expect(screen.getByRole('status', { name: 'Preview ready' })).toHaveTextContent(
      'Simulation ready.',
    );

    rerender(
      <InlineStateNotice label="Preview blocked" tone="error">
        Simulation failed.
      </InlineStateNotice>,
    );

    expect(screen.getByRole('alert', { name: 'Preview blocked' })).toHaveTextContent(
      'Simulation failed.',
    );
  });
});
