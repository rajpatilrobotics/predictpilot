export function formatQuoteAmount(value: bigint, symbol = 'dUSDC') {
  return `${formatDecimalBigint(value, 6)} ${symbol}`;
}

export function formatOptionalQuoteAmount(value: bigint | undefined) {
  return value === undefined ? 'Unavailable' : formatQuoteAmount(value);
}

export function formatPrice1e9(value: bigint) {
  const whole = value / 1_000_000_000n;
  const fraction = value % 1_000_000_000n;
  const cents = (fraction / 10_000_000n).toString().padStart(2, '0');

  return `${whole.toLocaleString()}.${cents}`;
}

export function formatScaled1e9(value: bigint) {
  return formatDecimalBigint(value, 9);
}

export function formatNullableScaled1e9(value: bigint | null) {
  return value === null ? 'Not set' : formatScaled1e9(value);
}

export function formatObjectId(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function formatTimestampMinute(value: bigint) {
  return new Date(Number(value)).toISOString().slice(0, 16).split('T').join(' ');
}

export function formatSafeIsoTimestamp(value: bigint) {
  const timestamp = Number(value);

  if (!Number.isSafeInteger(timestamp)) {
    return value.toString();
  }

  return new Date(timestamp).toISOString();
}

export function formatNullableTimestamp(value: bigint | null) {
  return value === null ? 'Unavailable' : formatSafeIsoTimestamp(value);
}

export function formatDuration(durationMs: bigint) {
  if (durationMs < 1_000n) {
    return `${durationMs.toString()}ms`;
  }

  const roundedSecondsText = (Number(durationMs) / 1_000).toFixed(1);
  const secondsText = roundedSecondsText.endsWith('.0')
    ? roundedSecondsText.slice(0, -2)
    : roundedSecondsText;
  return `${secondsText}s`;
}

export function formatAge(ageMs: bigint | null) {
  return ageMs === null ? 'Unavailable' : formatDuration(ageMs);
}

export function formatLifecycleLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDecimalBigint(value: bigint, decimals: number) {
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;
  const padded = absoluteValue.toString().padStart(decimals + 1, '0');
  const whole = formatGroupedInteger(padded.slice(0, -decimals));
  const fraction = trimTrailingZeros(padded.slice(-decimals));
  const formatted = fraction.length === 0 ? whole : `${whole}.${fraction}`;

  return isNegative ? `-${formatted}` : formatted;
}

export function trimTrailingZeros(value: string) {
  let endIndex = value.length;

  while (endIndex > 0 && value[endIndex - 1] === '0') {
    endIndex -= 1;
  }

  return value.slice(0, endIndex);
}

function formatGroupedInteger(value: string) {
  const normalizedValue = value === '' ? '0' : value;
  const groups: string[] = [];

  for (let index = normalizedValue.length; index > 0; index -= 3) {
    groups.unshift(normalizedValue.slice(Math.max(0, index - 3), index));
  }

  return groups.join(',');
}
