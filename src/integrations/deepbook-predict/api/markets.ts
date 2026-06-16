import { deepbookPredictConfig } from '@/config/deepbookPredict';
import { createPredictServerClient, type PredictServerClient } from '@/integrations/deepbook-predict/client';
import type { PredictStateDto } from '@/integrations/deepbook-predict/schemas';
import { MoveTypeSchema } from '@/integrations/deepbook-predict/schemas';
import type { MoveType, ObjectId, PredictStateModel } from '@/types/predict';
import type { OracleSummaryModel } from '@/types/oracle';
import { mapOracleSummaryDtoToModel, PredictAdapterError } from './oracles';

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
  predictId = deepbookPredictConfig.predictObjectId as ObjectId,
}: GetPredictStateOptions = {}): Promise<PredictStateModel> {
  const dto = await client.fetchPredictStateDto(predictId);
  return mapPredictStateDtoToModel(dto);
}

export async function getPredictOracles({
  client = createPredictServerClient(),
  predictId = deepbookPredictConfig.predictObjectId as ObjectId,
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

function normalizeMoveType(value: string): MoveType {
  const canonical = value.startsWith('0x') ? value : `0x${value}`;
  const parsed = MoveTypeSchema.safeParse(canonical);

  if (!parsed.success) {
    throw new PredictAdapterError(`Expected a Move type, received: ${value}`);
  }

  return parsed.data as MoveType;
}
