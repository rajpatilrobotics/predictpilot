import {
  buildRedeemRangeTx,
  type RedeemRangeTxPreview,
} from '@/integrations/deepbook-predict/tx/redeem-range';
import type { RangeTradeAmountEstimator } from '@/integrations/deepbook-predict/tx/preview-range';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { QuoteAmount, RangeKeyModel } from '@/types/predict';
import type { ManagerSummaryModel, RangePositionModel } from '@/types/portfolio';
import type { QueryClient } from '@tanstack/react-query';
import {
  useRangeTradeExecutionFlow,
  type BeginRangeTradeReviewResult,
  type RangeTradeFlowPhase,
  type RangeTradeFlowState,
} from './useRangeTradeExecutionFlow';

export type RangeRedeemFlowPhase = RangeTradeFlowPhase;

export interface UseRangeRedeemFlowOptions {
  askBounds?: OracleAskBoundsModel;
  estimateTradeAmounts?: RangeTradeAmountEstimator;
  executionTransport?: PredictTransactionTransport;
  manager: UsePredictManagerResult;
  managerSummary?: ManagerSummaryModel | null;
  nowMs?: number;
  oracleState: OracleStateModel;
  queryClient?: Pick<QueryClient, 'invalidateQueries'>;
  simulationTransport?: PredictSimulationTransport | null;
  walletStatus: WalletStatusModel;
}

export interface BeginRangeRedeemReviewInput {
  ownedRangePosition?: Pick<RangePositionModel, 'key' | 'quantityQuote'> | null;
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
}

export type BeginRangeRedeemReviewResult = BeginRangeTradeReviewResult;

export type RangeRedeemFlowState = RangeTradeFlowState<RedeemRangeTxPreview>;

const rangeRedeemFlowCopy = {
  invalidKeyMessage: 'A valid range key is required before redeem range execution.',
  invalidKeyRecovery: 'Choose an open range position for the selected oracle.',
  invalidQuantityMessage: 'Range redeem quantity must be greater than zero.',
  invalidQuantityRecovery: 'Enter a positive quantity before opening the execution review.',
  invalidRangeMessage: 'Range lower strike must be below higher strike.',
  invalidRangeRecovery: 'Choose a lower strike that is strictly below the higher strike.',
  missingManagerSummaryMessage: 'PredictManager summary is required before range redeem execution.',
  missingManagerSummaryRecovery:
    'Refresh manager state before opening the range redeem execution review.',
  missingOwnedPositionMessage: 'An open range position is required before redeem execution.',
  missingOwnedPositionRecovery:
    'Choose a range market with an open position before opening the redeem review.',
  quantityExceedsOwnedMessage: 'Redeem quantity exceeds the open range position quantity.',
  quantityExceedsOwnedRecovery:
    'Choose a quantity that is less than or equal to the open range position quantity.',
  reviewTitle: 'Range redeem execution review',
  signatureNotReadyMessage:
    'Range redeem simulation must be ready before requesting a wallet signature.',
  simulationRequiredMessage:
    'Exact range redeem payout is not fabricated. Review the simulation before requesting a wallet signature.',
  statusLabel: 'useRangeRedeemFlow',
} as const;

export function useRangeRedeemFlow(options: UseRangeRedeemFlowOptions) {
  const flow = useRangeTradeExecutionFlow({
    ...options,
    action: 'REDEEM_RANGE',
    buildTransaction: buildRedeemRangeTx,
    copy: rangeRedeemFlowCopy,
  });

  return {
    beginRedeemRangeReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}
