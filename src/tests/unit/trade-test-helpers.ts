import type { UseQueryResult } from '@tanstack/react-query';
import { predictDeploymentConfig } from '@/config/predict';
import type { UsePredictManagerResult } from '@/features/manager/hooks/usePredictManager';
import type { ManagerSummaryPortfolioModel } from '@/features/portfolio/lib/portfolio-selectors';
import type { WalletStatusModel } from '@/features/wallet/useWalletStatus';
import type { PredictPilotError } from '@/lib/errors';
import type { OracleAskBoundsModel, OracleStateModel } from '@/types/oracle';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { ManagerPositionsSummaryModel, ManagerSummaryModel } from '@/types/portfolio';

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

export function createTradePositionsSummary() {
  const summary: ManagerPositionsSummaryModel = {
    binaryPositions: [],
    managerId: tradeTestManagerId,
    rangePositions: [],
  };

  return {
    binaryGroups: [],
    binaryPositionCount: 0,
    isEmpty: true,
    managerId: tradeTestManagerId,
    openBinaryPositionCount: 0,
    openRangePositionCount: 0,
    rangeGroups: [],
    rangePositionCount: 0,
    summary,
    totalOpenBinaryQuantityQuote: 0n,
    totalOpenRangeQuantityQuote: 0n,
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
    manager: {
      checkpoint: 1n,
      checkpointTimestampMs: BigInt(tradeTestNowMs),
      digest: 'manager-created-digest',
      eventDigest: 'manager-created-event',
      eventIndex: 0,
      managerId: tradeTestManagerId,
      owner: tradeTestOwner,
      packageId: predictDeploymentConfig.packageId,
      sender: tradeTestOwner,
      txIndex: 0,
    },
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
