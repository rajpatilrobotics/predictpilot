import { MoveTypeSchema, ObjectIdSchema } from '@/integrations/deepbook-predict/schemas';
import type {
  MoveType,
  ObjectId,
  QuoteAmount,
  SuiAddress,
  TimestampMs,
  TransactionDigest,
} from '@/types/predict';

type Integerish = number | string;
type Numberish = number | string;

export interface IndexedEventDtoLike {
  event_digest: string;
  digest: string;
  sender: string;
  checkpoint: Integerish;
  checkpoint_timestamp_ms: Integerish;
  tx_index: number;
  event_index: number;
  package: string;
}

export interface IndexedEventModel {
  eventDigest: string;
  digest: TransactionDigest;
  sender: SuiAddress;
  checkpoint: bigint;
  checkpointTimestampMs: TimestampMs;
  txIndex: number;
  eventIndex: number;
  packageId: ObjectId;
}

export class PredictAdapterError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PredictAdapterError';
  }
}

export function mapIndexedEventDtoToModel(dto: IndexedEventDtoLike): IndexedEventModel {
  return {
    checkpoint: toBigInt(dto.checkpoint),
    checkpointTimestampMs: toBigInt(dto.checkpoint_timestamp_ms),
    digest: dto.digest,
    eventDigest: dto.event_digest,
    eventIndex: dto.event_index,
    packageId: normalizeObjectId(dto.package),
    sender: dto.sender as SuiAddress,
    txIndex: dto.tx_index,
  };
}

export function normalizeObjectId(value: string): ObjectId {
  const canonical = value.startsWith('0x') ? value : `0x${value}`;
  const parsed = ObjectIdSchema.safeParse(canonical);

  if (!parsed.success) {
    throw new PredictAdapterError(`Expected a 32-byte Sui object ID, received: ${value}`);
  }

  return parsed.data as ObjectId;
}

export function normalizeMoveType(value: string): MoveType {
  const canonical = value.startsWith('0x') ? value : `0x${value}`;
  const parsed = MoveTypeSchema.safeParse(canonical);

  if (!parsed.success) {
    throw new PredictAdapterError(`Expected a Move type, received: ${value}`);
  }

  return parsed.data as MoveType;
}

export function toBigInt(value: Integerish): bigint {
  return BigInt(value);
}

export function toNullableBigInt(value: Integerish | null): bigint | null {
  return value === null ? null : toBigInt(value);
}

export function toOptionalBigInt(value: Integerish | null | undefined): bigint | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return toBigInt(value);
}

export function toQuoteAmount(value: Integerish): QuoteAmount {
  return toBigInt(value);
}

export function toOptionalQuoteAmount(
  value: Integerish | null | undefined,
): QuoteAmount | undefined {
  return toOptionalBigInt(value);
}

export function toTimestampMs(value: Integerish): TimestampMs {
  return toBigInt(value);
}

export function toNumber(value: Numberish): number {
  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new PredictAdapterError(`Expected a finite number, received: ${value}`);
  }

  return numberValue;
}
