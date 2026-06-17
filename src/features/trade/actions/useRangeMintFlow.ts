import {
  buildMintRangeTx,
  type MintRangeTxPreview,
} from '@/integrations/deepbook-predict/tx/mint-range';
import type { RangeTradeAmountEstimator } from '@/integrations/deepbook-predict/tx/preview-range';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { QuoteAmount, RangeKeyModel } from '@/types/predict';
import type { ManagerSummaryModel } from '@/types/portfolio';
import type { QueryClient } from '@tanstack/react-query';
import {
  useRangeTradeExecutionFlow,
  type BeginRangeTradeReviewResult,
  type RangeTradeFlowPhase,
  type RangeTradeFlowState,
} from './useRangeTradeExecutionFlow';

export type RangeMintFlowPhase = RangeTradeFlowPhase;

export interface UseRangeMintFlowOptions {
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

export interface BeginRangeMintReviewInput {
  quantityQuote?: QuoteAmount | null;
  rangeKey?: RangeKeyModel | null;
}

export type BeginRangeMintReviewResult = BeginRangeTradeReviewResult;

export type RangeMintFlowState = RangeTradeFlowState<MintRangeTxPreview>;

const rangeMintFlowCopy = {
  invalidKeyMessage: 'A valid range key is required before mint range execution.',
  invalidKeyRecovery: 'Choose valid lower and higher strikes for the selected oracle.',
  invalidQuantityMessage: 'Range mint quantity must be greater than zero.',
  invalidQuantityRecovery: 'Enter a positive quantity before opening the execution review.',
  invalidRangeMessage: 'Range lower strike must be below higher strike.',
  invalidRangeRecovery: 'Choose a lower strike that is strictly below the higher strike.',
  missingManagerSummaryMessage: 'PredictManager summary is required before range mint execution.',
  missingManagerSummaryRecovery:
    'Refresh manager state before opening the range mint execution review.',
  reviewTitle: 'Range mint execution review',
  signatureNotReadyMessage:
    'Range mint simulation must be ready before requesting a wallet signature.',
  simulationRequiredMessage:
    'Exact range mint cost is not fabricated. Review the simulation before requesting a wallet signature.',
  statusLabel: 'useRangeMintFlow',
} as const;

export function useRangeMintFlow(options: UseRangeMintFlowOptions) {
  const flow = useRangeTradeExecutionFlow({
    ...options,
    action: 'MINT_RANGE',
    buildTransaction: buildMintRangeTx,
    copy: rangeMintFlowCopy,
  });

  return {
    beginMintRangeReview: flow.beginReview,
    canRequestSignature: flow.canRequestSignature,
    closeModal: flow.closeModal,
    requestSignature: flow.requestSignature,
    rerunSimulation: flow.rerunSimulation,
    reset: flow.reset,
    state: flow.state,
  };
}
