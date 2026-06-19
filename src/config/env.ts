import { z } from 'zod';

type RawRuntimeEnv = Record<string, boolean | number | string | undefined>;

export const defaultPublicRuntimeEnv = {
  VITE_SUI_NETWORK: 'testnet',
  VITE_SUI_GRPC_URL: 'https://fullnode.testnet.sui.io:443',
  VITE_PREDICT_SERVER_URL: 'https://predict-server.testnet.mystenlabs.com',
  VITE_PREDICT_PACKAGE_ID: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
  VITE_PREDICT_REGISTRY_ID: '0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64',
  VITE_PREDICT_OBJECT_ID: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
  VITE_PREDICT_QUOTE_TYPE:
    '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
  VITE_PREDICT_QUOTE_CURRENCY_ID:
    '0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c',
  VITE_PREDICT_QUOTE_DECIMALS: '6',
  VITE_PLP_TYPE: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP',
  VITE_DEFAULT_ORACLE_ID: 'TODO_VERIFY',
  VITE_DEFAULT_MARKET_ID: 'TODO_VERIFY',
  VITE_SUI_EXPLORER_URL: 'https://explorer.sui.io',
  VITE_ENABLE_JUDGE_MODE: 'true',
} as const;

const suiIdSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected a 32-byte Sui ID');
const moveTypeSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/);
const todoOrIdSchema = z.union([suiIdSchema, z.literal('TODO_VERIFY')]);

const runtimeEnvSchema = z.object({
  VITE_SUI_NETWORK: z.literal('testnet'),
  VITE_SUI_GRPC_URL: z.string().url(),
  VITE_PREDICT_SERVER_URL: z.string().url(),
  VITE_PREDICT_PACKAGE_ID: suiIdSchema,
  VITE_PREDICT_REGISTRY_ID: suiIdSchema,
  VITE_PREDICT_OBJECT_ID: suiIdSchema,
  VITE_PREDICT_QUOTE_TYPE: moveTypeSchema,
  VITE_PREDICT_QUOTE_CURRENCY_ID: suiIdSchema,
  VITE_PREDICT_QUOTE_DECIMALS: z.coerce.number().int().nonnegative(),
  VITE_PLP_TYPE: moveTypeSchema,
  VITE_DEFAULT_ORACLE_ID: todoOrIdSchema,
  VITE_DEFAULT_MARKET_ID: todoOrIdSchema,
  VITE_SUI_EXPLORER_URL: z.string().url(),
  VITE_ENABLE_JUDGE_MODE: z.coerce.boolean(),
});

export type RuntimeConfig = ReturnType<typeof parseRuntimeEnv>;

function compactEnv(env: RawRuntimeEnv) {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
}

function shouldUseDevDefaults(env: RawRuntimeEnv) {
  return env.DEV === true || env.MODE === 'test';
}

export function parseRuntimeEnv(env: RawRuntimeEnv) {
  const envForParsing = shouldUseDevDefaults(env)
    ? { ...defaultPublicRuntimeEnv, ...compactEnv(env) }
    : compactEnv(env);

  const parsed = runtimeEnvSchema.parse(envForParsing);

  return {
    suiNetwork: parsed.VITE_SUI_NETWORK,
    suiGrpcUrl: parsed.VITE_SUI_GRPC_URL,
    predictServerUrl: parsed.VITE_PREDICT_SERVER_URL,
    predictPackageId: parsed.VITE_PREDICT_PACKAGE_ID,
    predictRegistryId: parsed.VITE_PREDICT_REGISTRY_ID,
    predictObjectId: parsed.VITE_PREDICT_OBJECT_ID,
    predictQuoteType: parsed.VITE_PREDICT_QUOTE_TYPE,
    predictQuoteCurrencyId: parsed.VITE_PREDICT_QUOTE_CURRENCY_ID,
    predictQuoteDecimals: parsed.VITE_PREDICT_QUOTE_DECIMALS,
    plpType: parsed.VITE_PLP_TYPE,
    defaultOracleId:
      parsed.VITE_DEFAULT_ORACLE_ID === 'TODO_VERIFY' ? undefined : parsed.VITE_DEFAULT_ORACLE_ID,
    defaultMarketId:
      parsed.VITE_DEFAULT_MARKET_ID === 'TODO_VERIFY' ? undefined : parsed.VITE_DEFAULT_MARKET_ID,
    suiExplorerUrl: parsed.VITE_SUI_EXPLORER_URL,
    enableJudgeMode: parsed.VITE_ENABLE_JUDGE_MODE,
  } as const;
}

export const runtimeConfig = parseRuntimeEnv(import.meta.env);
