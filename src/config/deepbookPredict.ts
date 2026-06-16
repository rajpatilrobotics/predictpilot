import { predictDeploymentConfig } from '@/config/predict';

export const deepbookPredictConfig = {
  defaultMarketId: predictDeploymentConfig.defaultMarketId,
  defaultOracleId: predictDeploymentConfig.defaultOracleId,
  network: predictDeploymentConfig.network,
  plpType: predictDeploymentConfig.plpType,
  predictObjectId: predictDeploymentConfig.predictObjectId,
  predictPackageId: predictDeploymentConfig.packageId,
  predictRegistryId: predictDeploymentConfig.registryId,
  predictServerUrl: predictDeploymentConfig.serverBaseUrl,
  quoteAsset: predictDeploymentConfig.quoteAsset,
} as const;
