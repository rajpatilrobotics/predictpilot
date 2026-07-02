interface BigIntPrototypeWithJson {
  toJSON?: () => string;
}

export function installBigIntJsonSerialization() {
  const prototype = BigInt.prototype as BigIntPrototypeWithJson;

  if (typeof prototype.toJSON === 'function') {
    return;
  }

  // React dev render instrumentation may JSON.stringify props/query data.
  // Amounts are already represented as decimal strings on the wire.
  Object.defineProperty(prototype, 'toJSON', {
    configurable: true,
    value(this: bigint) {
      return this.toString();
    },
  });
}
