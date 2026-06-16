import { predictDeploymentConfig } from '@/config/predict';
import { suiConfig } from '@/config/sui';
import { normalizeObjectId } from '@/integrations/deepbook-predict/api/mapping';
import { SuiAddressSchema } from '@/integrations/deepbook-predict/schemas';
import { appSuiClient } from '@/lib/sui-client';
import {
  createAppError,
  insufficientWalletDusdcError,
  managerNotFoundError,
  normalizeAppError,
  type PredictPilotError,
} from '@/lib/errors';
import type { MoveType, ObjectId, QuoteAmount, SuiAddress } from '@/types/predict';

type SuiObjectOwner = unknown;

interface SuiObjectResponse {
  digest: string;
  json?: Record<string, unknown> | null;
  objectId: string;
  owner: SuiObjectOwner;
  previousTransaction?: string | null;
  type: string;
  version: string;
}

interface SuiCoinResponse {
  balance: string;
  digest: string;
  objectId: string;
  owner: SuiObjectOwner;
  type: string;
  version: string;
}

export interface AuthoritativeSuiClient {
  getObject: (input: {
    include?: {
      json?: boolean;
      previousTransaction?: boolean;
    };
    objectId: string;
  }) => Promise<{ object: SuiObjectResponse }>;
  listCoins: (input: {
    coinType?: string;
    cursor?: string | null;
    limit?: number;
    owner: string;
  }) => Promise<{
    cursor: string | null;
    hasNextPage: boolean;
    objects: SuiCoinResponse[];
  }>;
}

export interface AuthoritativeObjectSnapshot {
  id: ObjectId;
  digest: string;
  json: Record<string, unknown> | null;
  network: typeof suiConfig.network;
  owner: SuiObjectOwner;
  previousTransaction: string | null;
  type: string;
  version: string;
}

export interface QuoteCoinModel {
  coinObjectId: ObjectId;
  balance: QuoteAmount;
  digest: string;
  owner: SuiObjectOwner;
  quoteAssetType: MoveType;
  type: string;
  version: string;
}

export interface QuoteCoinSelectionModel {
  coins: QuoteCoinModel[];
  requestedAmount: QuoteAmount;
  selectedAmount: QuoteAmount;
}

export interface ReadAuthoritativeObjectOptions {
  client?: AuthoritativeSuiClient;
  includeJson?: boolean;
}

export interface ReadManagerObjectOptions extends ReadAuthoritativeObjectOptions {
  managerId: ObjectId;
}

export interface ReadOracleObjectOptions extends ReadAuthoritativeObjectOptions {
  oracleId: ObjectId;
}

export interface ReadQuoteCoinObjectOptions extends ReadAuthoritativeObjectOptions {
  coinObjectId: ObjectId;
}

export interface ListWalletQuoteCoinsOptions {
  client?: AuthoritativeSuiClient;
  owner: SuiAddress;
  pageSize?: number;
}

export interface SelectWalletQuoteCoinsOptions extends ListWalletQuoteCoinsOptions {
  amount: QuoteAmount;
}

export async function readAuthoritativeManagerObject({
  client,
  includeJson,
  managerId,
}: ReadManagerObjectOptions): Promise<AuthoritativeObjectSnapshot> {
  return readAuthoritativeObject({
    client,
    id: managerId,
    includeJson,
    missingError: managerNotFoundError({ managerId }),
  });
}

export async function readAuthoritativeOracleObject({
  client,
  includeJson,
  oracleId,
}: ReadOracleObjectOptions): Promise<AuthoritativeObjectSnapshot> {
  return readAuthoritativeObject({
    client,
    id: oracleId,
    includeJson,
    missingError: createAppError('ONCHAIN_OBJECT_NOT_FOUND', {
      context: { objectId: oracleId, objectKind: 'oracle' },
    }),
  });
}

export async function readAuthoritativeQuoteCoinObject({
  client,
  coinObjectId,
  includeJson,
}: ReadQuoteCoinObjectOptions): Promise<AuthoritativeObjectSnapshot> {
  return readAuthoritativeObject({
    client,
    id: coinObjectId,
    includeJson,
    missingError: createAppError('ONCHAIN_OBJECT_NOT_FOUND', {
      context: { objectId: coinObjectId, objectKind: 'quote-coin' },
    }),
  });
}

export async function listWalletQuoteCoins({
  client = appSuiClient,
  owner,
  pageSize = 50,
}: ListWalletQuoteCoinsOptions): Promise<QuoteCoinModel[]> {
  validateSuiAddress(owner);

  const quoteAssetType = predictDeploymentConfig.quoteAsset.type;
  const coins: QuoteCoinModel[] = [];
  let cursor: string | null = null;

  try {
    do {
      const page = await client.listCoins({
        coinType: quoteAssetType,
        cursor,
        limit: pageSize,
        owner,
      });

      coins.push(...page.objects.map((coin) => mapQuoteCoin(coin, quoteAssetType)));
      cursor = page.hasNextPage ? page.cursor : null;
    } while (cursor !== null);
  } catch (error) {
    throw toThrowableAppError(
      normalizeAppError(error, {
        context: {
          owner,
          quoteAssetType,
          readPath: 'wallet-quote-coins',
        },
      }),
    );
  }

  return coins.sort(compareQuoteCoinsForSelection);
}

export async function selectWalletQuoteCoinsForAmount({
  amount,
  client,
  owner,
  pageSize,
}: SelectWalletQuoteCoinsOptions): Promise<QuoteCoinSelectionModel> {
  const requestedAmount = BigInt(amount);
  const coins = await listWalletQuoteCoins({ client, owner, pageSize });
  const selectedCoins: QuoteCoinModel[] = [];
  let selectedAmount = 0n;

  for (const coin of coins) {
    if (selectedAmount >= requestedAmount) {
      break;
    }

    selectedCoins.push(coin);
    selectedAmount += coin.balance;
  }

  if (selectedAmount < requestedAmount) {
    throw toThrowableAppError(
      insufficientWalletDusdcError({
        availableQuote: selectedAmount.toString(),
        owner,
        quoteAssetType: predictDeploymentConfig.quoteAsset.type,
        requestedQuote: requestedAmount.toString(),
      }),
    );
  }

  return {
    coins: selectedCoins,
    requestedAmount,
    selectedAmount,
  };
}

interface ReadAuthoritativeObjectInternalOptions {
  client?: AuthoritativeSuiClient;
  id: ObjectId;
  includeJson?: boolean;
  missingError: PredictPilotError;
}

async function readAuthoritativeObject({
  client = appSuiClient,
  id,
  includeJson = true,
  missingError,
}: ReadAuthoritativeObjectInternalOptions): Promise<AuthoritativeObjectSnapshot> {
  const objectId = normalizeObjectId(id);

  try {
    const { object } = await client.getObject({
      include: {
        json: includeJson,
        previousTransaction: true,
      },
      objectId,
    });

    return mapObjectSnapshot(object);
  } catch (error) {
    if (isMissingObjectError(error)) {
      throw toThrowableAppError(missingError);
    }

    throw toThrowableAppError(
      normalizeAppError(error, {
        context: {
          objectId,
          readPath: 'authoritative-object',
        },
      }),
    );
  }
}

function mapObjectSnapshot(object: SuiObjectResponse): AuthoritativeObjectSnapshot {
  return {
    digest: object.digest,
    id: normalizeObjectId(object.objectId),
    json: object.json ?? null,
    network: suiConfig.network,
    owner: object.owner,
    previousTransaction: object.previousTransaction ?? null,
    type: object.type,
    version: object.version,
  };
}

function mapQuoteCoin(coin: SuiCoinResponse, quoteAssetType: MoveType): QuoteCoinModel {
  return {
    balance: BigInt(coin.balance),
    coinObjectId: normalizeObjectId(coin.objectId),
    digest: coin.digest,
    owner: coin.owner,
    quoteAssetType,
    type: coin.type,
    version: coin.version,
  };
}

function compareQuoteCoinsForSelection(left: QuoteCoinModel, right: QuoteCoinModel) {
  if (left.balance !== right.balance) {
    return left.balance > right.balance ? -1 : 1;
  }

  return left.coinObjectId.localeCompare(right.coinObjectId);
}

function validateSuiAddress(address: SuiAddress) {
  SuiAddressSchema.parse(address);
}

function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    /(does not exist|not found|notexists|deleted|missing object|object .* missing)/i.test(
      error.message,
    )
  );
}

function toThrowableAppError(error: PredictPilotError) {
  return Object.assign(new Error(error.message), error);
}
