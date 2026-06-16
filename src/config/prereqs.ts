import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';

export type PredictPilotPrerequisiteId =
  | 'manager-dusdc'
  | 'predict-manager'
  | 'sui-gas'
  | 'sui-testnet-network'
  | 'wallet-connected'
  | 'wallet-dusdc';

export type PredictPilotPrerequisiteCategory = 'funding' | 'manager' | 'network' | 'wallet';

export type PredictPilotPrerequisiteFlow =
  | 'all-wallet-actions'
  | 'lp-actions'
  | 'manager-funding'
  | 'trade-actions';

export interface PredictPilotPrerequisite {
  automatedInApp: boolean;
  blocking: boolean;
  category: PredictPilotPrerequisiteCategory;
  externalSetup: boolean;
  id: PredictPilotPrerequisiteId;
  label: string;
  recovery: string;
  requiredFor: readonly PredictPilotPrerequisiteFlow[];
  summary: string;
}

export const predictPilotPrerequisiteConfig = {
  automaticDusdcFundingAvailable: false,
  automaticSuiGasFundingAvailable: false,
  network: suiConfig.network,
  quoteAsset: predictDeploymentConfig.quoteAsset,
  walletChain: suiConfig.walletChain,
} as const;

export const predictPilotPrerequisites = [
  {
    automatedInApp: false,
    blocking: true,
    category: 'network',
    externalSetup: false,
    id: 'sui-testnet-network',
    label: 'Sui Testnet network',
    recovery: 'Switch the connected wallet to Sui Testnet before continuing.',
    requiredFor: ['all-wallet-actions'],
    summary: `PredictPilot currently supports ${suiConfig.network} only.`,
  },
  {
    automatedInApp: false,
    blocking: true,
    category: 'wallet',
    externalSetup: false,
    id: 'wallet-connected',
    label: 'Connected Sui wallet',
    recovery: 'Connect a Wallet Standard compatible Sui wallet.',
    requiredFor: ['all-wallet-actions'],
    summary: 'A connected wallet is required before any signing flow can begin.',
  },
  {
    automatedInApp: false,
    blocking: true,
    category: 'funding',
    externalSetup: true,
    id: 'sui-gas',
    label: 'Testnet SUI gas',
    recovery: 'Fund the operator wallet with Testnet SUI through the official Sui faucet.',
    requiredFor: ['all-wallet-actions'],
    summary: 'SUI gas must already exist in the Testnet wallet before any transaction.',
  },
  {
    automatedInApp: false,
    blocking: true,
    category: 'funding',
    externalSetup: true,
    id: 'wallet-dusdc',
    label: 'Wallet dUSDC',
    recovery:
      'Request DeepBook Predict Testnet DUSDC through the official token request flow before demo rehearsal.',
    requiredFor: ['manager-funding', 'trade-actions', 'lp-actions'],
    summary: `The current quote asset is DUSDC (${predictDeploymentConfig.quoteAsset.type}) with ${predictDeploymentConfig.quoteAsset.decimals} decimals.`,
  },
  {
    automatedInApp: false,
    blocking: true,
    category: 'manager',
    externalSetup: false,
    id: 'predict-manager',
    label: 'PredictManager',
    recovery: "Create or select the connected wallet's reusable PredictManager before trading.",
    requiredFor: ['manager-funding', 'trade-actions'],
    summary: 'Trading actions require a reusable per-wallet PredictManager.',
  },
  {
    automatedInApp: false,
    blocking: true,
    category: 'manager',
    externalSetup: false,
    id: 'manager-dusdc',
    label: 'Manager dUSDC funding',
    recovery: 'Deposit wallet DUSDC into the selected PredictManager before minting or redeeming.',
    requiredFor: ['trade-actions'],
    summary: 'Trade flows spend quote balance inside the PredictManager, not raw wallet balance.',
  },
] as const satisfies readonly PredictPilotPrerequisite[];
