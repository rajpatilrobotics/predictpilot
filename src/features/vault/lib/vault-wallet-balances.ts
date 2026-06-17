import { predictDeploymentConfig } from '@/config/predict';
import {
  listWalletQuoteCoins,
  readWalletPlpBalance,
  type AuthoritativeSuiClient,
} from '@/integrations/deepbook-predict/onchain/objects';
import type { QuoteAmount, SuiAddress } from '@/types/predict';

export const vaultWalletBalanceQueryKeys = {
  all: ['deepbook-predict', 'wallet-balances'] as const,
  plp: (owner: SuiAddress) =>
    [...vaultWalletBalanceQueryKeys.all, owner, 'plp', predictDeploymentConfig.plpType] as const,
  quote: (owner: SuiAddress) =>
    [
      ...vaultWalletBalanceQueryKeys.all,
      owner,
      'quote',
      predictDeploymentConfig.quoteAsset.type,
    ] as const,
} as const;

export async function getWalletDusdcBalanceQuote({
  client,
  owner,
}: {
  client?: AuthoritativeSuiClient;
  owner: SuiAddress;
}): Promise<QuoteAmount> {
  const coins = await listWalletQuoteCoins({ client, owner });

  return coins.reduce<QuoteAmount>((total, coin) => total + coin.balance, 0n as QuoteAmount);
}

export async function getWalletPlpBalanceAtomic({
  client,
  owner,
}: {
  client?: AuthoritativeSuiClient;
  owner: SuiAddress;
}): Promise<bigint> {
  const balance = await readWalletPlpBalance({ client, owner });

  return balance.totalBalanceAtomic;
}
