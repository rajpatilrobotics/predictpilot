import { runtimeConfig } from '@/config/env';

export const featureFlags = {
  enableJudgeMode: runtimeConfig.enableJudgeMode,
} as const;

export type FeatureFlags = typeof featureFlags;
