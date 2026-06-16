import { isSuiGrpcClient } from '@mysten/sui/grpc';
import { describe, expect, it } from 'vitest';
import { defaultPublicRuntimeEnv, parseRuntimeEnv } from '@/config/env';
import {
  assertSupportedSuiNetwork,
  isSupportedSuiNetwork,
  SUI_TESTNET_NETWORK,
  SUI_TESTNET_WALLET_CHAIN,
  suiConfig,
  supportedSuiNetworks,
} from '@/config/sui';
import {
  appSuiClient,
  createSuiGrpcClient,
  createSuiGrpcClientForNetwork,
} from '@/lib/sui-client';

describe('Sui Testnet configuration', () => {
  it('exposes one Testnet-only network config source', () => {
    expect(supportedSuiNetworks).toEqual(['testnet']);
    expect(suiConfig).toMatchObject({
      explorerUrl: 'https://explorer.sui.io',
      grpcUrl: 'https://fullnode.testnet.sui.io:443',
      network: SUI_TESTNET_NETWORK,
      supportedNetworks: ['testnet'],
      walletChain: SUI_TESTNET_WALLET_CHAIN,
    });
  });

  it('rejects non-Testnet runtime network config', () => {
    expect(() =>
      parseRuntimeEnv({
        ...defaultPublicRuntimeEnv,
        VITE_SUI_NETWORK: 'mainnet',
      }),
    ).toThrow();
  });

  it('checks supported networks without silently falling back', () => {
    expect(isSupportedSuiNetwork('testnet')).toBe(true);
    expect(isSupportedSuiNetwork('devnet')).toBe(false);
    expect(isSupportedSuiNetwork('mainnet')).toBe(false);
    expect(assertSupportedSuiNetwork('testnet')).toBe('testnet');
    expect(() => assertSupportedSuiNetwork('mainnet')).toThrow(/Testnet only/);
  });

  it('constructs the shared app Sui gRPC client without network calls', () => {
    expect(isSuiGrpcClient(appSuiClient)).toBe(true);
    expect(isSuiGrpcClient(createSuiGrpcClient())).toBe(true);
    expect(isSuiGrpcClient(createSuiGrpcClientForNetwork('testnet'))).toBe(true);
    expect(() => createSuiGrpcClientForNetwork('devnet')).toThrow(/Testnet only/);
  });
});
