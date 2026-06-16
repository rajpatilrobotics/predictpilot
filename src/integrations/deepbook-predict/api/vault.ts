import { predictDeploymentConfig } from '@/config/predict';
import {
  createPredictServerClient,
  type PredictServerClient,
} from '@/integrations/deepbook-predict/client';
import type { VaultPerformanceDto, VaultSummaryDto } from '@/integrations/deepbook-predict/schemas';
import type { ObjectId } from '@/types/predict';
import type { VaultModel, VaultPerformanceModel, VaultPerformancePoint } from '@/types/vault';
import {
  normalizeMoveType,
  PredictAdapterError,
  toNumber,
  toQuoteAmount,
  toTimestampMs,
} from './mapping';

export type VaultReadClient = Pick<
  PredictServerClient,
  'fetchVaultPerformanceDto' | 'fetchVaultSummaryDto'
>;

export interface GetVaultSummaryOptions {
  client?: VaultReadClient;
  predictId?: ObjectId;
}

export interface GetVaultPerformanceOptions {
  client?: VaultReadClient;
  predictId?: ObjectId;
  range?: 'ALL';
}

export async function getVaultSummary({
  client = createPredictServerClient(),
  predictId = predictDeploymentConfig.predictObjectId,
}: GetVaultSummaryOptions = {}): Promise<VaultModel> {
  const dto = await client.fetchVaultSummaryDto(predictId);
  return mapVaultSummaryDtoToModel(dto);
}

export async function getVaultPerformance({
  client = createPredictServerClient(),
  predictId = predictDeploymentConfig.predictObjectId,
  range = 'ALL',
}: GetVaultPerformanceOptions = {}): Promise<VaultPerformanceModel> {
  const dto = await client.fetchVaultPerformanceDto(predictId, range);
  return mapVaultPerformanceDtoToModel(dto);
}

export function mapVaultSummaryDtoToModel(dto: VaultSummaryDto): VaultModel {
  const quoteAssetTypes = dto.quote_assets.map(normalizeMoveType);
  const quoteAssetType = quoteAssetTypes[0];

  if (quoteAssetType === undefined) {
    throw new PredictAdapterError('Vault summary did not include any quote assets');
  }

  return {
    assetBalanceQuote: toQuoteAmount(dto.vault_balance),
    availableLiquidityQuote: toQuoteAmount(dto.available_liquidity),
    availableWithdrawalQuote: toQuoteAmount(dto.available_withdrawal),
    lastRefreshedAtMs: null,
    maxPayoutUtilizationRatio: toNumber(dto.max_payout_utilization),
    netDepositsQuote: toQuoteAmount(dto.net_deposits),
    plpSharePrice: toNumber(dto.plp_share_price),
    plpTotalSupplyAtomic: toQuoteAmount(dto.plp_total_supply),
    predictId: dto.predict_id as ObjectId,
    quoteAssetType,
    quoteAssetTypes,
    totalMaxPayoutQuote: toQuoteAmount(dto.total_max_payout),
    totalMtmQuote: toQuoteAmount(dto.total_mtm),
    totalSuppliedQuote: toQuoteAmount(dto.total_supplied),
    totalWithdrawnQuote: toQuoteAmount(dto.total_withdrawn),
    utilizationRatio: toNumber(dto.utilization),
    vaultBalanceQuote: toQuoteAmount(dto.vault_balance),
    vaultValueQuote: toQuoteAmount(dto.vault_value),
  };
}

export function mapVaultPerformanceDtoToModel(dto: VaultPerformanceDto): VaultPerformanceModel {
  return {
    points: dto.points.map(mapVaultPerformancePointDtoToModel),
    predictId: dto.predict_id as ObjectId,
    range: dto.range,
  };
}

function mapVaultPerformancePointDtoToModel(
  point: VaultPerformanceDto['points'][number],
): VaultPerformancePoint {
  return {
    sharePrice: toNumber(point.share_price),
    timestampMs: toTimestampMs(point.timestamp_ms),
    totalSharesAtomic: toQuoteAmount(point.total_shares),
    vaultValueQuote: toQuoteAmount(point.vault_value),
  };
}
