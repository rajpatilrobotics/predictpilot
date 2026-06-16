import { runtimeConfig } from '@/config/env';

export const deepbookPredictConfig = {
  network: runtimeConfig.suiNetwork,
  predictServerUrl: runtimeConfig.predictServerUrl,
  predictPackageId: runtimeConfig.predictPackageId,
  predictRegistryId: runtimeConfig.predictRegistryId,
  predictObjectId: runtimeConfig.predictObjectId,
  quoteAsset: {
    type: runtimeConfig.predictQuoteType,
    currencyId: runtimeConfig.predictQuoteCurrencyId,
    decimals: runtimeConfig.predictQuoteDecimals,
  },
  plpType: runtimeConfig.plpType,
  defaultOracleId: runtimeConfig.defaultOracleId,
  defaultMarketId: runtimeConfig.defaultMarketId,
} as const;
