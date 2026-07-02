import type { OracleAskBoundsModel, OracleSummaryModel } from '@/types/oracle';
import type { BinaryDirection, MarketKeyModel, Price1e9, RangeKeyModel } from '@/types/predict';

export type StrikeInput = bigint | number | string;

export type MarketKeyValidationField =
  | 'higherStrike1e9'
  | 'lowerStrike1e9'
  | 'strike1e9'
  | 'tickSize1e9';

export type MarketKeyValidationErrorCode =
  | 'RANGE_ORDER_INVALID'
  | 'STRIKE_BELOW_MINIMUM'
  | 'STRIKE_NEGATIVE'
  | 'STRIKE_NOT_INTEGER'
  | 'STRIKE_NOT_ON_TICK'
  | 'TICK_SIZE_INVALID';

export type MarketKeyValidationWarningCode =
  | 'ASK_BOUNDS_PRESENT_UNMAPPED'
  | 'ASK_BOUNDS_UNAVAILABLE';

export interface MarketKeyValidationError {
  code: MarketKeyValidationErrorCode;
  field: MarketKeyValidationField;
  message: string;
}

export interface MarketKeyValidationWarning {
  code: MarketKeyValidationWarningCode;
  message: string;
}

export type MarketKeyBuildResult<TKey> =
  | {
      key: TKey;
      ok: true;
      warnings: MarketKeyValidationWarning[];
    }
  | {
      errors: MarketKeyValidationError[];
      ok: false;
      warnings: MarketKeyValidationWarning[];
    };

export interface BuildBinaryMarketKeyOptions {
  askBounds?: OracleAskBoundsModel;
  direction: BinaryDirection;
  oracle: OracleSummaryModel;
  strike1e9: StrikeInput;
}

export interface BuildRangeKeyOptions {
  askBounds?: OracleAskBoundsModel;
  higherStrike1e9: StrikeInput;
  lowerStrike1e9: StrikeInput;
  oracle: OracleSummaryModel;
}

interface NormalizedStrikeResult {
  errors: MarketKeyValidationError[];
  strike1e9: Price1e9 | null;
}

export function buildBinaryMarketKey({
  askBounds,
  direction,
  oracle,
  strike1e9,
}: BuildBinaryMarketKeyOptions): MarketKeyBuildResult<MarketKeyModel> {
  const warnings = askBoundsWarnings(askBounds);
  const normalizedStrike = normalizeStrikeInput({
    field: 'strike1e9',
    oracle,
    value: strike1e9,
  });

  if (normalizedStrike.errors.length > 0 || normalizedStrike.strike1e9 === null) {
    return {
      errors: normalizedStrike.errors,
      ok: false,
      warnings,
    };
  }

  return {
    key: {
      direction,
      expiryMs: oracle.expiryMs,
      oracleId: oracle.oracleId,
      strike1e9: normalizedStrike.strike1e9,
    },
    ok: true,
    warnings,
  };
}

export function buildRangeKey({
  askBounds,
  higherStrike1e9,
  lowerStrike1e9,
  oracle,
}: BuildRangeKeyOptions): MarketKeyBuildResult<RangeKeyModel> {
  const warnings = askBoundsWarnings(askBounds);
  const normalizedLowerStrike = normalizeStrikeInput({
    field: 'lowerStrike1e9',
    oracle,
    value: lowerStrike1e9,
  });
  const normalizedHigherStrike = normalizeStrikeInput({
    field: 'higherStrike1e9',
    oracle,
    value: higherStrike1e9,
  });
  const errors = [...normalizedLowerStrike.errors, ...normalizedHigherStrike.errors];

  if (
    normalizedLowerStrike.strike1e9 !== null &&
    normalizedHigherStrike.strike1e9 !== null &&
    normalizedLowerStrike.strike1e9 >= normalizedHigherStrike.strike1e9
  ) {
    errors.push({
      code: 'RANGE_ORDER_INVALID',
      field: 'higherStrike1e9',
      message: 'Higher strike must be greater than lower strike.',
    });
  }

  if (
    errors.length > 0 ||
    normalizedLowerStrike.strike1e9 === null ||
    normalizedHigherStrike.strike1e9 === null
  ) {
    return {
      errors,
      ok: false,
      warnings,
    };
  }

  return {
    key: {
      expiryMs: oracle.expiryMs,
      higherStrike1e9: normalizedHigherStrike.strike1e9,
      lowerStrike1e9: normalizedLowerStrike.strike1e9,
      oracleId: oracle.oracleId,
    },
    ok: true,
    warnings,
  };
}

function normalizeStrikeInput({
  field,
  oracle,
  value,
}: {
  field: MarketKeyValidationField;
  oracle: OracleSummaryModel;
  value: StrikeInput;
}): NormalizedStrikeResult {
  const errors: MarketKeyValidationError[] = [];
  const strike1e9 = parseStrikeInput(value);

  if (strike1e9 === null) {
    return {
      errors: [
        {
          code: 'STRIKE_NOT_INTEGER',
          field,
          message: 'Strike must be an integer price value.',
        },
      ],
      strike1e9: null,
    };
  }

  if (strike1e9 < 0n) {
    errors.push({
      code: 'STRIKE_NEGATIVE',
      field,
      message: 'Strike must be non-negative.',
    });
  }

  if (strike1e9 < oracle.minStrike1e9) {
    errors.push({
      code: 'STRIKE_BELOW_MINIMUM',
      field,
      message: 'Strike must be greater than or equal to the oracle minimum strike.',
    });
  }

  if (oracle.tickSize1e9 <= 0n) {
    errors.push({
      code: 'TICK_SIZE_INVALID',
      field: 'tickSize1e9',
      message: 'Oracle tick size must be positive.',
    });
  } else if (strike1e9 >= oracle.minStrike1e9) {
    const offset = strike1e9 - oracle.minStrike1e9;
    if (offset % oracle.tickSize1e9 !== 0n) {
      errors.push({
        code: 'STRIKE_NOT_ON_TICK',
        field,
        message: 'Strike must align to the oracle tick size.',
      });
    }
  }

  return {
    errors,
    strike1e9,
  };
}

function parseStrikeInput(value: StrikeInput): Price1e9 | null {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? BigInt(value) : null;
  }

  return /^-?\d+$/.test(value) ? BigInt(value) : null;
}

function askBoundsWarnings(
  askBounds: OracleAskBoundsModel | undefined,
): MarketKeyValidationWarning[] {
  if (askBounds === undefined) {
    return [];
  }

  switch (askBounds.status) {
    case 'UNAVAILABLE':
      return [
        {
          code: 'ASK_BOUNDS_UNAVAILABLE',
          message: 'Ask bounds are unavailable for this oracle.',
        },
      ];
    case 'PRESENT_UNMAPPED':
      return [
        {
          code: 'ASK_BOUNDS_PRESENT_UNMAPPED',
          message: 'Ask bounds are present but their exact server fields are not mapped yet.',
        },
      ];
  }
}
