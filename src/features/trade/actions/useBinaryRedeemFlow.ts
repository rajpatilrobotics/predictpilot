import {
  buildRedeemBinaryTx,
  type RedeemBinaryTxPreview,
} from '@/integrations/deepbook-predict/tx/redeem-binary';
import type { BinaryTradeAmountEstimator } from '@/integrations/deepbook-predict/tx/preview-binary';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { MarketKeyModel, QuoteAmount } from '@/types/predict';
import type { BinaryPositionSummaryModel, ManagerSummaryModel } from '@/types/portfolio';
import type { QueryClient } from '@tanstack/react-query';
import {
  useBinaryTradeExecutionFlow,
  type BeginBinaryTradeReviewResult,
  type BinaryTradeFlowPhase,
  type BinaryTradeFlowState,
} from './useBinaryTradeExecutionFlow';

export type BinaryRedeemFlowPhase = BinaryTradeFlowPhase;

export interface UseBinaryRedeemFlowOptions {
  askBounds?: OracleAskBoundsModel;
  estimateTradeAmounts?: BinaryTradeAmountEstimator;
  executionTransport?: PredictTransactionTransport;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
}

export interface BeginBinaryRedeemReviewInput {
  marketKey?: MarketKeyModel | null;
  ownedPosition?: Pick<BinaryPositionSummaryModel, 'key' | 'openQuantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
}

export type BeginBinaryRedeemReviewResult = BeginBinaryTradeReviewResult;

export type BinaryRedeemFlowState = BinaryTradeFlowState<RedeemBinaryTxPreview>;

const binaryRedeemFlowCopy = {
  invalidKeyMessage: 'A valid binary market key is required before redeem execution.',
  invalidKeyRecovery: 'Choose an open binary position for the selected oracle.',
  invalidQuantityMessage: 'Binary redeem quantity must be greater than zero.',
  invalidQuantityRecovery: 'Enter a positive quantity before opening the execution review.',
  missingManagerSummaryMessage:
    'PredictManager summary is required before binary redeem execution.',
  missingManagerSummaryRecovery:
    'Refresh manager state before opening the redeem execution review.',
  missingOwnedPositionMessage: 'An open binary position is required before redeem execution.',
  missingOwnedPositionRecovery:
    'Choose a binary market with an open position before opening the redeem review.',
  quantityExceedsOwnedMessage: 'Redeem quantity exceeds the open binary position quantity.',
  quantityExceedsOwnedRecovery:
    'Choose a quantity that is less than or equal to the open position quantity.',
  reviewTitle: 'Binary redeem execution review',
  signatureNotReadyMessage:
    'Binary redeem simulation must be ready before requesting a wallet signature.',
  simulationRequiredMessage:
    'Exact redeem payout is not fabricated. Review the simulation before requesting a wallet signature.',
  statusLabel: 'useBinaryRedeemFlow',
} as const;

export function useBinaryRedeemFlow(options: UseBinaryRedeemFlowOptions) {
  const flow = useBinaryTradeExecutionFlow({
    ...options,
    action: 'REDEEM',
    buildTransaction: buildRedeemBinaryTx,
    copy: binaryRedeemFlowCopy,
  });

  return {
    beginRedeemReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}
