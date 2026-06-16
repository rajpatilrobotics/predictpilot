import { predictDeploymentConfig } from '@/config/predict';
import {
  createPredictServerClient,
  type PredictServerClient,
} from '@/integrations/deepbook-predict/client';
import type { PredictStateDto } from '@/integrations/deepbook-predict/schemas';
import type { ObjectId, PredictStateModel } from '@/types/predict';
import type { OracleSummaryModel } from '@/types/oracle';
import { normalizeMoveType } from './mapping';
import { mapOracleSummaryDtoToModel } from './oracles';

export type MarketReadClient = Pick<
  PredictServerClient,
  'fetchPredictOraclesDto' | 'fetchPredictStateDto'
>;

export interface GetPredictStateOptions {
  client?: MarketReadClient;
  predictId?: ObjectId;
}

export interface GetPredictOraclesOptions {
  client?: MarketReadClient;
  predictId?: ObjectId;
}

export async function getPredictState({
  client = createPredictServerClient(),
  predictId = predictDeploymentConfig.predictObjectId,
}: GetPredictStateOptions = {}): Promise<PredictStateModel> {
  const dto = await client.fetchPredictStateDto(predictId);
  return mapPredictStateDtoToModel(dto);
}

export async function getPredictOracles({
  client = createPredictServerClient(),
  predictId = predictDeploymentConfig.predictObjectId,
}: GetPredictOraclesOptions = {}): Promise<OracleSummaryModel[]> {
  const dto = await client.fetchPredictOraclesDto(predictId);
  return dto.map(mapOracleSummaryDtoToModel);
}

export function mapPredictStateDtoToModel(dto: PredictStateDto): PredictStateModel {
  return {
    predictId: dto.predict_id as ObjectId,
    pricingStatus: dto.pricing === null || dto.pricing === undefined ? 'MISSING' : 'PRESENT',
    quoteAssets: dto.quote_assets.map(normalizeMoveType),
    riskStatus: dto.risk === null || dto.risk === undefined ? 'MISSING' : 'PRESENT',
    tradingPaused: dto.trading_paused,
  };
}
