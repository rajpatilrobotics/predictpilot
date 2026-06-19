import {
  buildMintBinaryTx,
  type MintBinaryTxPreview,
} from '@/integrations/deepbook-predict/tx/mint-binary';
import type { BinaryTradeAmountEstimator } from '@/integrations/deepbook-predict/tx/preview-binary';
import type { HistoryReadClient } from '@/integrations/deepbook-predict/api/history';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, QuoteAmount } from '@/types/predict';
import type { ManagerSummaryModel } from '@/types/portfolio';
import type { QueryClient } from '@tanstack/react-query';
import {
  useBinaryTradeExecutionFlow,
  type BeginBinaryTradeReviewResult,
  type BinaryTradeFlowPhase,
  type BinaryTradeFlowState,
} from './useBinaryTradeExecutionFlow';

export type BinaryMintFlowPhase = BinaryTradeFlowPhase;

export interface UseBinaryMintFlowOptions {
  askBounds?: OracleAskBoundsModel;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  executionTransport?: PredictTransactionTransport;
  historyClient?: HistoryReadClient;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  tradeRecoveryMaxAttempts?: number;
  tradeRecoveryPollDelayMs?: number;
  walletStatus: WalletStatusModel;
  walletReturnTimeoutMs?: number;
}

export interface BeginBinaryMintReviewInput {
  marketKey?: MarketKeyModel | null;
  quantityQuote?: QuoteAmount | null;
}

export type BeginBinaryMintReviewResult = BeginBinaryTradeReviewResult;

export type BinaryMintFlowState = BinaryTradeFlowState<MintBinaryTxPreview>;

const binaryMintFlowCopy = {
  invalidKeyMessage: 'A valid binary market key is required before mint execution.',
  invalidKeyRecovery: 'Choose a valid direction and strike for the selected oracle.',
  invalidQuantityMessage: 'Binary mint quantity must be greater than zero.',
  invalidQuantityRecovery: 'Enter a positive quantity before opening the execution review.',
  missingManagerSummaryMessage: 'PredictManager summary is required before binary mint execution.',
  missingManagerSummaryRecovery: 'Refresh manager state before opening the mint execution review.',
  reviewTitle: 'Binary mint execution review',
  signatureNotReadyMessage:
    'Binary mint simulation must be ready before requesting a wallet signature.',
  simulationRequiredMessage:
    'Exact mint cost is not fabricated. Review the simulation before requesting a wallet signature.',
  statusLabel: 'useBinaryMintFlow',
} as const;

export function useBinaryMintFlow(options: UseBinaryMintFlowOptions) {
  const flow = useBinaryTradeExecutionFlow({
    ...options,
    action: 'MINT',
    buildTransaction: buildMintBinaryTx,
    copy: binaryMintFlowCopy,
  });

  return {
    beginMintReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}
