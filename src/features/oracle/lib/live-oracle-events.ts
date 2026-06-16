import { predictDeploymentConfig } from '@/config/predict';
import type { ObjectId } from '@/types/predict';

export const PREDICT_ORACLE_LIVE_EVENT_SUFFIXES = [
  'oracle::OraclePricesUpdated',
  'oracle::OracleSVIUpdated',
  'oracle::OracleSettled',
  'oracle::OracleActivated',
] as const;

export type PredictOracleLiveEventSuffix = (typeof PREDICT_ORACLE_LIVE_EVENT_SUFFIXES)[number];
export type PredictOracleLiveEventType = `${ObjectId}::${PredictOracleLiveEventSuffix}`;

export interface PredictOracleLiveEventMetadata {
  eventTypeSuffixes: readonly PredictOracleLiveEventSuffix[];
  eventTypes: readonly PredictOracleLiveEventType[];
  packageId: ObjectId;
}

export function buildPredictOracleLiveEventTypes(
  packageId: ObjectId = predictDeploymentConfig.packageId,
): PredictOracleLiveEventType[] {
  return PREDICT_ORACLE_LIVE_EVENT_SUFFIXES.map((suffix) =>
    formatPredictOracleLiveEventType(packageId, suffix),
  );
}

export function getPredictOracleLiveEventMetadata(
  packageId: ObjectId = predictDeploymentConfig.packageId,
): PredictOracleLiveEventMetadata {
  return {
    eventTypeSuffixes: PREDICT_ORACLE_LIVE_EVENT_SUFFIXES,
    eventTypes: buildPredictOracleLiveEventTypes(packageId),
    packageId,
  };
}

export const predictOracleLiveEventMetadata = getPredictOracleLiveEventMetadata();

function formatPredictOracleLiveEventType(
  packageId: ObjectId,
  suffix: PredictOracleLiveEventSuffix,
): PredictOracleLiveEventType {
  return `${packageId}::${suffix}`;
}
