import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App shell', () => {
  it('renders the PredictPilot foundation shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /DeepBook Predict Terminal/i })).toBeInTheDocument();
    expect(screen.getByText('Vite + React + TypeScript')).toBeInTheDocument();
  });
});
