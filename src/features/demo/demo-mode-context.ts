import { createContext, useContext } from 'react';

export type DemoStepId =
  | 'oracle-readiness'
  | 'strategy-preview'
  | 'manager-portfolio'
  | 'vault-plp'
  | 'proof-boundary';

export interface DemoStep {
  description: string;
  id: DemoStepId;
  label: string;
  liveBoundary: string;
  routeHref: string;
  routeLabel: string;
  title: string;
}

export interface DemoFixtureCard {
  helper: string;
  label: string;
  value: string;
}

export interface DemoHistoryItem {
  kind: string;
  note: string;
  timestamp: string;
}

export interface DemoModeFixture {
  history: readonly DemoHistoryItem[];
  manager: readonly DemoFixtureCard[];
  oracle: readonly DemoFixtureCard[];
  vault: readonly DemoFixtureCard[];
}

export interface DemoModeMetadata {
  dataSource: 'curated-offline-fixture';
  executionMode: 'simulated-ui-only';
  labels: readonly string[];
}

export interface DemoModeContextValue {
  currentStep: DemoStep;
  currentStepIndex: number;
  fixture: DemoModeFixture;
  goToStep: (index: number) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  metadata: DemoModeMetadata;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  steps: readonly DemoStep[];
}

export const demoSteps = [
  {
    description:
      'Start with an active oracle, lifecycle status, expiry context, and freshness language so the judge sees this is a DeepBook Predict market, not a generic betting card.',
    id: 'oracle-readiness',
    label: 'Oracle',
    liveBoundary:
      'Live app route: Markets and Oracle Status read the Predict server and oracle freshness hooks.',
    routeHref: '/markets',
    routeLabel: 'Open live markets',
    title: 'Oracle readiness',
  },
  {
    description:
      'Walk through binary and range strategy parameters with risk preview copy before any wallet action is possible.',
    id: 'strategy-preview',
    label: 'Strategy',
    liveBoundary:
      'Live app route: Market Detail builds real PTB previews only after selected inputs validate.',
    routeHref: '/markets/0x123',
    routeLabel: 'Open strategy route',
    title: 'Strategy preview',
  },
  {
    description:
      'Show how a PredictManager owns balances and positions internally, with portfolio state separated from wallet balances.',
    id: 'manager-portfolio',
    label: 'Manager',
    liveBoundary:
      'Live app route: Portfolio uses manager discovery, manager summary, positions, PnL, and history hooks.',
    routeHref: '/portfolio',
    routeLabel: 'Open live portfolio',
    title: 'Manager and portfolio',
  },
  {
    description:
      'Explain the vault counterparty model and PLP share context without inventing LP output math.',
    id: 'vault-plp',
    label: 'Vault',
    liveBoundary:
      'Live app route: Vault supply and withdraw flows use configured PTB builders and simulation review.',
    routeHref: '/vault',
    routeLabel: 'Open live vault',
    title: 'Vault and PLP',
  },
  {
    description:
      'Close by showing where real Testnet proof appears: wallet signature, transaction digest, and refreshed indexed state.',
    id: 'proof-boundary',
    label: 'Proof',
    liveBoundary:
      'Demo mode never creates proof. Real proof appears only after a wallet-confirmed Testnet transaction.',
    routeHref: '/history',
    routeLabel: 'Open live history',
    title: 'Proof boundary',
  },
] as const satisfies readonly DemoStep[];

export const demoFixture = {
  history: [
    {
      kind: 'Binary mint fixture',
      note: 'Preview path only; no transaction digest is fabricated.',
      timestamp: 'T-03 min',
    },
    {
      kind: 'Vault supply fixture',
      note: 'PLP consequence is explained, exact minted output remains live-confirmed only.',
      timestamp: 'T-01 min',
    },
  ],
  manager: [
    {
      helper: 'Fixture state for walkthrough copy only.',
      label: 'PredictManager',
      value: 'Ready sample',
    },
    {
      helper: 'Manager balance is not merged with wallet balance.',
      label: 'Manager DUSDC',
      value: '1,250.00 dUSDC',
    },
    {
      helper: 'Positions are internal manager quantities.',
      label: 'Open positions',
      value: '2 binary, 1 range',
    },
  ],
  oracle: [
    {
      helper: 'Curated market name for judge narration.',
      label: 'Oracle',
      value: 'BTC weekly expiry',
    },
    {
      helper: 'Lifecycle wording mirrors OracleSVI states.',
      label: 'Lifecycle',
      value: 'ACTIVE fixture',
    },
    {
      helper: 'Freshness is illustrative, not a live server read.',
      label: 'Freshness',
      value: '< 30s sample',
    },
  ],
  vault: [
    {
      helper: 'Vault is the counterparty to Predict trades.',
      label: 'Available liquidity',
      value: '920,000 dUSDC',
    },
    {
      helper: 'PLP represents LP share context.',
      label: 'PLP share price',
      value: '1.018 sample',
    },
    {
      helper: 'Coverage constraints still need live validation.',
      label: 'Withdraw status',
      value: 'Requires live check',
    },
  ],
} as const satisfies DemoModeFixture;

export const demoMetadata = {
  dataSource: 'curated-offline-fixture',
  executionMode: 'simulated-ui-only',
  labels: [
    'Demo mode',
    'Offline fixture',
    'Not live Testnet proof',
    'No wallet signature will be requested',
  ],
} as const satisfies DemoModeMetadata;

export const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function useDemoMode() {
  const context = useContext(DemoModeContext);

  if (context === null) {
    throw new Error('useDemoMode must be used inside DemoModeProvider');
  }

  return context;
}
