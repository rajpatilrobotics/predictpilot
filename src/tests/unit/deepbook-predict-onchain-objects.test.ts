import { describe, expect, it, vi } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import {
  listWalletPlpCoins,
  listWalletQuoteCoins,
  readAuthoritativeManagerObject,
  readAuthoritativeOracleObject,
  readAuthoritativeQuoteCoinObject,
  readWalletPlpBalance,
  selectWalletQuoteCoinsForAmount,
  type AuthoritativeSuiClient,
} from '@/integrations/deepbook-predict/onchain/objects';
import type { ObjectId, SuiAddress } from '@/types/predict';

const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const oracleId = '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const coinA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as ObjectId;
const coinB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as ObjectId;
const coinC = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as ObjectId;

function createMockClient(): AuthoritativeSuiClient {
  return {
    getObject: vi.fn(),
    listCoins: vi.fn(),
  };
}

function mockObjectResponse(objectId: ObjectId, type: string) {
  return {
    object: {
      digest: `digest-${objectId.slice(2, 8)}`,
      json: { fields: { intentionallyUnparsed: true } },
      objectId,
      owner: { Shared: { initial_shared_version: '1' } },
      previousTransaction: 'previous-digest',
      type,
      version: '42',
    },
  };
}

function mockCoin(
  objectId: ObjectId,
  balance: string,
  coinType = predictDeploymentConfig.quoteAsset.type,
) {
  return {
    balance,
    digest: `digest-${objectId.slice(2, 8)}`,
    objectId,
    owner: { AddressOwner: owner },
    type: `0x2::coin::Coin<${coinType}>`,
    version: '7',
  };
}

describe('DeepBook Predict authoritative onchain object helpers', () => {
  it('reads a manager object snapshot without parsing unverified internals', async () => {
    const client = createMockClient();
    vi.mocked(client.getObject).mockResolvedValue(
      mockObjectResponse(
        managerId,
        `${predictDeploymentConfig.packageId}::predict_manager::PredictManager`,
      ),
    );

    const snapshot = await readAuthoritativeManagerObject({ client, managerId });

    expect(client.getObject).toHaveBeenCalledWith({
      include: {
        json: true,
        previousTransaction: true,
      },
      objectId: managerId,
    });
    expect(snapshot).toMatchObject({
      digest: 'digest-640e9a',
      id: managerId,
      json: { fields: { intentionallyUnparsed: true } },
      network: 'testnet',
      previousTransaction: 'previous-digest',
      version: '42',
    });
    expect(snapshot.json).not.toHaveProperty('owner');
  });

  it('reads an oracle object snapshot without lifecycle guessing', async () => {
    const client = createMockClient();
    vi.mocked(client.getObject).mockResolvedValue(
      mockObjectResponse(oracleId, `${predictDeploymentConfig.packageId}::oracle::OracleSVI`),
    );

    const snapshot = await readAuthoritativeOracleObject({
      client,
      includeJson: false,
      oracleId,
    });

    expect(client.getObject).toHaveBeenCalledWith({
      include: {
        json: false,
        previousTransaction: true,
      },
      objectId: oracleId,
    });
    expect(snapshot).toMatchObject({
      id: oracleId,
      json: { fields: { intentionallyUnparsed: true } },
      network: 'testnet',
      type: `${predictDeploymentConfig.packageId}::oracle::OracleSVI`,
    });
    expect(snapshot).not.toHaveProperty('lifecycleStatus');
  });

  it('maps missing manager and oracle objects to app error codes', async () => {
    const managerClient = createMockClient();
    const oracleClient = createMockClient();
    const coinClient = createMockClient();
    vi.mocked(managerClient.getObject).mockRejectedValue(new Error('Object does not exist'));
    vi.mocked(oracleClient.getObject).mockRejectedValue(new Error('Object not found'));
    vi.mocked(coinClient.getObject).mockRejectedValue(new Error('Object has been deleted'));

    await expect(
      readAuthoritativeManagerObject({ client: managerClient, managerId }),
    ).rejects.toMatchObject({
      code: 'MANAGER_NOT_FOUND',
    });
    await expect(
      readAuthoritativeOracleObject({ client: oracleClient, oracleId }),
    ).rejects.toMatchObject({
      code: 'ONCHAIN_OBJECT_NOT_FOUND',
    });
    await expect(
      readAuthoritativeQuoteCoinObject({ client: coinClient, coinObjectId: coinA }),
    ).rejects.toMatchObject({
      code: 'ONCHAIN_OBJECT_NOT_FOUND',
    });
  });

  it('normalizes unexpected Sui client failures through the app error layer', async () => {
    const client = createMockClient();
    vi.mocked(client.getObject).mockRejectedValue(new Error('transport exploded'));

    await expect(readAuthoritativeOracleObject({ client, oracleId })).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      context: {
        objectId: oracleId,
        readPath: 'authoritative-object',
      },
    });
  });

  it('lists wallet quote coins with the configured DUSDC type across pages', async () => {
    const client = createMockClient();
    vi.mocked(client.listCoins)
      .mockResolvedValueOnce({
        cursor: 'next-page',
        hasNextPage: true,
        objects: [mockCoin(coinA, '100')],
      })
      .mockResolvedValueOnce({
        cursor: null,
        hasNextPage: false,
        objects: [mockCoin(coinB, '500')],
      });

    const coins = await listWalletQuoteCoins({ client, owner, pageSize: 1 });

    expect(client.listCoins).toHaveBeenNthCalledWith(1, {
      coinType: predictDeploymentConfig.quoteAsset.type,
      cursor: null,
      limit: 1,
      owner,
    });
    expect(client.listCoins).toHaveBeenNthCalledWith(2, {
      coinType: predictDeploymentConfig.quoteAsset.type,
      cursor: 'next-page',
      limit: 1,
      owner,
    });
    expect(coins.map((coin) => coin.coinObjectId)).toEqual([coinB, coinA]);
    expect(coins.map((coin) => coin.balance)).toEqual([500n, 100n]);
  });

  it('selects quote coins largest-first until the requested amount is covered', async () => {
    const client = createMockClient();
    vi.mocked(client.listCoins).mockResolvedValue({
      cursor: null,
      hasNextPage: false,
      objects: [mockCoin(coinA, '100'), mockCoin(coinB, '500'), mockCoin(coinC, '300')],
    });

    const selection = await selectWalletQuoteCoinsForAmount({
      amount: 650n,
      client,
      owner,
    });

    expect(selection).toMatchObject({
      requestedAmount: 650n,
      selectedAmount: 800n,
    });
    expect(selection.coins.map((coin) => coin.coinObjectId)).toEqual([coinB, coinC]);
  });

  it('fails before transaction building when wallet quote balance is insufficient', async () => {
    const client = createMockClient();
    vi.mocked(client.listCoins).mockResolvedValue({
      cursor: null,
      hasNextPage: false,
      objects: [mockCoin(coinA, '100')],
    });

    await expect(
      selectWalletQuoteCoinsForAmount({
        amount: 101n,
        client,
        owner,
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_WALLET_DUSDC',
      context: {
        availableQuote: '100',
        requestedQuote: '101',
      },
    });
  });

  it('lists wallet PLP coins with the configured PLP type and totals the balance', async () => {
    const client = createMockClient();
    vi.mocked(client.listCoins).mockResolvedValue({
      cursor: null,
      hasNextPage: false,
      objects: [
        mockCoin(coinA, '100', predictDeploymentConfig.plpType),
        mockCoin(coinB, '500', predictDeploymentConfig.plpType),
      ],
    });

    const coins = await listWalletPlpCoins({ client, owner });
    const balance = await readWalletPlpBalance({ client, owner });

    expect(client.listCoins).toHaveBeenNthCalledWith(1, {
      coinType: predictDeploymentConfig.plpType,
      cursor: null,
      limit: 50,
      owner,
    });
    expect(coins.map((coin) => coin.coinObjectId)).toEqual([coinB, coinA]);
    expect(coins.map((coin) => coin.balanceAtomic)).toEqual([500n, 100n]);
    expect(balance).toMatchObject({
      owner,
      plpType: predictDeploymentConfig.plpType,
      totalBalanceAtomic: 600n,
    });
  });

  it('normalizes PLP coin read failures through the app error layer', async () => {
    const client = createMockClient();
    vi.mocked(client.listCoins).mockRejectedValue(new Error('transport failed'));

    await expect(listWalletPlpCoins({ client, owner })).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      context: {
        owner,
        plpType: predictDeploymentConfig.plpType,
        readPath: 'wallet-plp-coins',
      },
    });
  });
});
