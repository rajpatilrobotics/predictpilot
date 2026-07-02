import type { UseQueryResult } from '@tanstack/react-query';
import { vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import {
  normalizeManagerPositionsSummary,
  type ManagerSummaryPortfolioModel,
} from '@/features/portfolio/lib/portfolio-selectors';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictSimulationTransport } from '@/integrations/deepbook-predict/tx/simulate';
import type { PredictPilotError } from '@/lib/errors';
import type { PredictTransactionTransport } from '@/lib/tx-executor';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type {
  BinaryPositionSummaryModel,
  ManagerPositionsSummaryModel,
  ManagerSummaryModel,
  RangePositionModel,
} from '@/types/portfolio';

export const tradeTestNowMs = 1_781_635_255_000;
export const tradeTestOracleId =
  '0x9c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
export const tradeTestOracleCapId =
  '0x0b8fb5c4514337dbd300ff2a49185a99433d8369670a23329126388364119817' as ObjectId;
export const tradeTestManagerId =
  '0x2c2da49c103556e6def22273d716f81f3d206c2a5823ea49c5bb6bf425a3238d' as ObjectId;
export const tradeTestOwner =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;

export function createTradeOracleState({
  lifecycleStatus = 'ACTIVE',
  priceTimestampMs = tradeTestNowMs - 1_000,
  sviTimestampMs = tradeTestNowMs - 2_000,
}: {
  lifecycleStatus?: OracleStateModel['oracle']['lifecycleStatus'];
  priceTimestampMs?: number;
  sviTimestampMs?: number;
} = {}): OracleStateModel {
  return {
    askBounds: { status: 'PRESENT_UNMAPPED' },
    latestPrice: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(priceTimestampMs),
      digest: 'price-digest',
      eventDigest: 'price-event',
      eventIndex: 0,
      forward1e9: 65_500_000_000_000n,
      onchainTimestampMs: BigInt(priceTimestampMs),
      oracleId: tradeTestOracleId,
      packageId: predictDeploymentConfig.packageId,
      sender: tradeTestOwner,
      spot1e9: 65_250_000_000_000n,
      txIndex: 0,
    },
    latestSvi: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(sviTimestampMs),
      digest: 'svi-digest',
      eventDigest: 'svi-event',
      eventIndex: 0,
      onchainTimestampMs: BigInt(sviTimestampMs),
      oracleId: tradeTestOracleId,
      packageId: predictDeploymentConfig.packageId,
      sender: tradeTestOwner,
      svi: {
        a1e9: 1_000_000_000n,
        b1e9: 2_000_000_000n,
        m1e9Signed: 0n,
        rho1e9Signed: 0n,
        sigma1e9: 500_000_000n,
      },
      txIndex: 0,
    },
    oracle: {
      activatedAtMs: BigInt(tradeTestNowMs - 5_000),
      createdCheckpoint: 1n,
      expiryMs: BigInt(tradeTestNowMs + 3_600_000),
      lifecycleStatus,
      minStrike1e9: 50_000_000_000_000n,
      oracleCapId: tradeTestOracleCapId,
      oracleId: tradeTestOracleId,
      predictId: predictDeploymentConfig.predictObjectId,
      settlementPrice1e9: null,
      settledAtMs: null,
      tickSize1e9: 1_000_000_000n,
      underlyingAsset: 'BTC',
    },
  };
}

export function createTradeManagerSummary(): ManagerSummaryModel {
  return {
    accountValueQuote: 5_000_000n,
    awaitingSettlementPositions: 0,
    balances: [
      {
        balanceQuote: 5_000_000n,
        quoteAssetType: predictDeploymentConfig.quoteAsset.type,
      },
    ],
    lastRefreshedAtMs: BigInt(tradeTestNowMs),
    managerId: tradeTestManagerId,
    openExposureQuote: 0n,
    openPositions: 0,
    owner: tradeTestOwner,
    realizedPnlQuote: 0n,
    redeemableValueQuote: 0n,
    tradingBalanceQuote: 5_000_000n,
    unrealizedPnlQuote: 0n,
  };
}

export function createTradeManagerSummaryPortfolio(): ManagerSummaryPortfolioModel {
  const summary = createTradeManagerSummary();

  return {
    balanceSummary: {
      accountValueQuote: summary.accountValueQuote,
      awaitingSettlementPositions: summary.awaitingSettlementPositions,
      balances: summary.balances,
      managerId: tradeTestManagerId,
      openExposureQuote: summary.openExposureQuote,
      openPositions: summary.openPositions,
      owner: tradeTestOwner,
      realizedPnlQuote: summary.realizedPnlQuote,
      redeemableValueQuote: summary.redeemableValueQuote,
      totalManagerBalanceQuote: summary.tradingBalanceQuote,
      tradingBalanceQuote: summary.tradingBalanceQuote,
      unrealizedPnlQuote: summary.unrealizedPnlQuote,
    },
    summary,
  };
}

export function createTradeBinaryPosition(
  overrides: Partial<BinaryPositionSummaryModel> = {},
): BinaryPositionSummaryModel {
  const oracleState = createTradeOracleState();

  return {
    averageEntryPrice1e9: 250_000_000n,
    firstMintedAtMs: BigInt(tradeTestNowMs - 60_000),
    key: {
      direction: 'UP',
      expiryMs: oracleState.oracle.expiryMs,
      oracleId: tradeTestOracleId,
      strike1e9: oracleState.oracle.minStrike1e9,
    },
    lastActivityAtMs: BigInt(tradeTestNowMs - 30_000),
    managerId: tradeTestManagerId,
    markPrice1e9: 300_000_000n,
    markValueQuote: 600_000n,
    mintedQuantityQuote: 2_000_000n,
    openCostBasisQuote: 500_000n,
    openQuantityQuote: 2_000_000n,
    predictId: predictDeploymentConfig.predictObjectId,
    quantityQuote: 2_000_000n,
    quoteAssetType: predictDeploymentConfig.quoteAsset.type,
    realizedPnlQuote: 0n,
    redeemedQuantityQuote: 0n,
    status: 'OPEN',
    totalCostQuote: 500_000n,
    totalPayoutQuote: 0n,
    underlyingAsset: oracleState.oracle.underlyingAsset,
    unrealizedPnlQuote: 100_000n,
    ...overrides,
  };
}

export function createTradePositionsSummary({
  binaryPositions = [],
  rangePositions = [],
}: {
  binaryPositions?: BinaryPositionSummaryModel[];
  rangePositions?: RangePositionModel[];
} = {}) {
  const summary: ManagerPositionsSummaryModel = {
    binaryPositions,
    managerId: tradeTestManagerId,
    rangePositions,
  };

  return normalizeManagerPositionsSummary(summary);
}

export function createTradeRangePosition(
  overrides: Partial<RangePositionModel> = {},
): RangePositionModel {
  const oracleState = createTradeOracleState();

  return {
    averageEntryQuote: 250_000n,
    key: {
      expiryMs: oracleState.oracle.expiryMs,
      higherStrike1e9: oracleState.oracle.minStrike1e9 + oracleState.oracle.tickSize1e9,
      lowerStrike1e9: oracleState.oracle.minStrike1e9,
      oracleId: tradeTestOracleId,
    },
    quantityQuote: 2_000_000n,
    unrealizedPnlQuote: 100_000n,
    ...overrides,
  };
}

export function createTradeManagerState(
  overrides: Partial<UsePredictManagerResult> = {},
): UsePredictManagerResult {
  return {
    authoritativeObject: {
      digest: 'manager-digest',
      id: tradeTestManagerId,
      json: null,
      network: 'testnet',
      owner: tradeTestOwner,
      previousTransaction: null,
      type: 'predict_manager::PredictManager',
      version: '1',
    },
    error: null,
    isAmbiguous: false,
    isConfirming: false,
    isLoading: false,
    isReady: true,
    manager: { managerId: tradeTestManagerId, owner: tradeTestOwner },
    managerId: tradeTestManagerId,
    matchingManagers: [],
    owner: tradeTestOwner,
    requiresCreateManager: false,
    status: 'READY',
    warnings: [],
    ...overrides,
  };
}

export function createTradeWalletStatus(
  overrides: Partial<WalletStatusModel> = {},
): WalletStatusModel {
  return {
    accountAddress: tradeTestOwner,
    currentNetwork: 'testnet',
    expectedNetwork: 'testnet',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isExpectedNetwork: true,
    isReconnecting: false,
    isWrongNetwork: false,
    shortAddress: '0x195b...56c',
    status: 'connected',
    statusLabel: 'Connected',
    supportedIntentsCount: 1,
    walletName: 'Test Wallet',
    ...overrides,
  };
}

export function querySuccess<T>(data: T): UseQueryResult<T, PredictPilotError> {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
  } as unknown as UseQueryResult<T, PredictPilotError>;
}

export function queryError<T>(error: PredictPilotError): UseQueryResult<T, PredictPilotError> {
  return {
    data: undefined,
    error,
    isError: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: false,
  } as unknown as UseQueryResult<T, PredictPilotError>;
}

export function presentAskBounds(): OracleAskBoundsModel {
  return { status: 'PRESENT_UNMAPPED' };
}

export function createReadyTradeSimulationTransport(): PredictSimulationTransport {
  return {
    simulateTransaction: vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        balanceChanges: [{ amount: '-1000' }],
        digest: 'sim-digest',
        effects: { status: { status: 'success' } },
        events: [{ type: 'binary-trade' }],
        objectTypes: {
          [tradeTestManagerId]: 'predict_manager::PredictManager',
        },
      },
      commandResults: [
        { mutatedReferences: [], returnValues: [{ bcs: new Uint8Array([1]) }] },
        { mutatedReferences: [{ bcs: new Uint8Array([2]) }], returnValues: [] },
      ],
    }),
  };
}

export function createTradeExecutionTransport({
  signAndExecuteTransaction = vi.fn().mockResolvedValue({
    $kind: 'Transaction',
    Transaction: {
      digest: 'tx-digest',
      effects: { status: { status: 'success' } },
    },
  }),
  waitForTransaction = vi.fn().mockResolvedValue({
    $kind: 'Transaction',
    Transaction: {
      digest: 'tx-digest',
      effects: { status: { status: 'success' } },
    },
  }),
}: Partial<PredictTransactionTransport> = {}): PredictTransactionTransport {
  return {
    signAndExecuteTransaction,
    waitForTransaction,
  };
}
