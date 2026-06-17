import { expect } from 'vitest';
import type { Transaction } from '@mysten/sui/transactions';
import { predictDeploymentConfig } from '@/config/predict';
import { predictProtocolTypes, predictTxTargets } from '@/integrations/deepbook-predict/targets';
import type {
  MarketKeyModel,
  ObjectId,
  QuoteAmount,
  RangeKeyModel,
  SuiAddress,
} from '@/types/predict';
import type { VaultModel } from '@/types/vault';

type TransactionData = ReturnType<Transaction['getData']>;
type TransactionCommand = TransactionData['commands'][number];

export const ptbSender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
export const ptbManagerId =
  '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
export const ptbOracleId =
  '0x175331eba3cbb60face9193d05d2efac052868d6cccaf80a62775e2e7eb0b462' as ObjectId;
export const ptbQuantityQuote = 100_000n as QuoteAmount;
export const ptbVaultAmountQuote = 1_500_000n as QuoteAmount;
export const ptbPlpAmountAtomic = 1_500_000n;
export const ptbWalletPlpBalanceAtomic = 2_000_000n;

export const ptbMarketKey = {
  direction: 'UP',
  expiryMs: 200_000n,
  oracleId: ptbOracleId,
  strike1e9: 65_000_000_000_000n,
} satisfies MarketKeyModel;

export const ptbRangeKey = {
  expiryMs: 200_000n,
  higherStrike1e9: 66_000_000_000_000n,
  lowerStrike1e9: 64_000_000_000_000n,
  oracleId: ptbOracleId,
} satisfies RangeKeyModel;

export function createVaultFixture(overrides: Partial<VaultModel> = {}): VaultModel {
  return {
    assetBalanceQuote: 5_000_000n,
    availableLiquidityQuote: 4_000_000n,
    availableWithdrawalQuote: 3_000_000n,
    lastRefreshedAtMs: 100_000n,
    maxPayoutUtilizationRatio: 0.25,
    netDepositsQuote: 5_000_000n,
    plpSharePrice: 1.02,
    plpTotalSupplyAtomic: 5_000_000n,
    predictId: predictDeploymentConfig.predictObjectId,
    quoteAssetType: predictProtocolTypes.quoteAssetType,
    quoteAssetTypes: [predictProtocolTypes.quoteAssetType],
    totalMaxPayoutQuote: 1_000_000n,
    totalMtmQuote: 50_000n,
    totalSuppliedQuote: 6_000_000n,
    totalWithdrawnQuote: 1_000_000n,
    utilizationRatio: 0.2,
    vaultBalanceQuote: 5_000_000n,
    vaultValueQuote: 5_100_000n,
    ...overrides,
  };
}

export function expectPtbOk<TResult extends { ok: boolean }>(
  result: TResult,
): Extract<TResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    const message =
      'error' in result && result.error instanceof Object && 'message' in result.error
        ? String(result.error.message)
        : 'Expected PTB builder to succeed.';
    throw new Error(message);
  }

  return result as Extract<TResult, { ok: true }>;
}

export function expectPtbError(
  result: { ok: boolean },
  {
    code,
    field,
  }: {
    code: string;
    field?: string;
  },
) {
  expect(result).toMatchObject({
    error: {
      code,
      ...(field === undefined
        ? {}
        : {
            context: {
              field,
            },
          }),
    },
    ok: false,
  });
}

export function expectWalletDisconnected(
  result: { ok: boolean },
  {
    action,
    builder,
  }: {
    action: string;
    builder: string;
  },
) {
  expect(result).toMatchObject({
    error: {
      code: 'WALLET_NOT_CONNECTED',
      context: {
        action,
        builder,
      },
    },
    ok: false,
  });
}

export function expectBinaryTradeTransaction({
  actionFunction,
  actionTarget,
  data,
  marketKeyFunction = 'up',
  marketKeyTarget = predictTxTargets.marketKey.up,
}: {
  actionFunction: 'mint' | 'redeem';
  actionTarget: typeof predictTxTargets.predict.mint | typeof predictTxTargets.predict.redeem;
  data: TransactionData;
  marketKeyFunction?: 'down' | 'up';
  marketKeyTarget?: typeof predictTxTargets.marketKey.down | typeof predictTxTargets.marketKey.up;
}) {
  expectManagerOracleTradeInputs(data, {
    keyPureInputCount: 3,
  });
  expect(data.commands).toMatchObject([
    {
      $kind: 'MoveCall',
      MoveCall: {
        arguments: [
          { $kind: 'Input', Input: 0, type: 'pure' },
          { $kind: 'Input', Input: 1, type: 'pure' },
          { $kind: 'Input', Input: 2, type: 'pure' },
        ],
        function: marketKeyFunction,
        module: 'market_key',
        package: predictDeploymentConfig.packageId,
        typeArguments: [],
      },
    },
    predictTradeMoveCall({
      actionFunction,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    }),
  ]);
  expectMoveCallTarget(data.commands[0], marketKeyTarget);
  expectMoveCallTarget(data.commands[1], actionTarget);
}

export function expectRangeTradeTransaction({
  actionFunction,
  actionTarget,
  data,
}: {
  actionFunction: 'mint_range' | 'redeem_range';
  actionTarget:
    | typeof predictTxTargets.predict.mintRange
    | typeof predictTxTargets.predict.redeemRange;
  data: TransactionData;
}) {
  expectManagerOracleTradeInputs(data, {
    keyPureInputCount: 4,
  });
  expect(data.commands).toMatchObject([
    {
      $kind: 'MoveCall',
      MoveCall: {
        arguments: [
          { $kind: 'Input', Input: 0, type: 'pure' },
          { $kind: 'Input', Input: 1, type: 'pure' },
          { $kind: 'Input', Input: 2, type: 'pure' },
          { $kind: 'Input', Input: 3, type: 'pure' },
        ],
        function: 'new',
        module: 'range_key',
        package: predictDeploymentConfig.packageId,
        typeArguments: [],
      },
    },
    predictTradeMoveCall({
      actionFunction,
      objectOffset: 4,
      quantityInput: 7,
      typeArguments: [predictProtocolTypes.quoteAssetType],
    }),
  ]);
  expectMoveCallTarget(data.commands[0], predictTxTargets.rangeKey.new);
  expectMoveCallTarget(data.commands[1], actionTarget);
}

export function expectVaultFlowTransaction({
  coinAmount,
  coinType,
  data,
  functionName,
  target,
}: {
  coinAmount: bigint;
  coinType: string;
  data: TransactionData;
  functionName: 'supply' | 'withdraw';
  target: typeof predictTxTargets.predict.supply | typeof predictTxTargets.predict.withdraw;
}) {
  expect(data.inputs).toMatchObject([unresolvedPredictInput(), clockInput(), { $kind: 'Pure' }]);
  expect(data.commands).toMatchObject([
    {
      $Intent: {
        data: {
          balance: coinAmount,
          outputKind: 'coin',
          type: coinType,
        },
        name: 'CoinWithBalance',
      },
      $kind: '$Intent',
    },
    {
      $kind: 'MoveCall',
      MoveCall: {
        arguments: [
          { $kind: 'Input', Input: 0, type: 'object' },
          { $kind: 'Result', Result: 0 },
          { $kind: 'Input', Input: 1, type: 'object' },
        ],
        function: functionName,
        module: 'predict',
        package: predictDeploymentConfig.packageId,
        typeArguments: [predictProtocolTypes.quoteAssetType],
      },
    },
    {
      $kind: 'TransferObjects',
      TransferObjects: {
        address: { $kind: 'Input', Input: 2, type: 'pure' },
        objects: [{ $kind: 'Result', Result: 1 }],
      },
    },
  ]);
  expectMoveCallTarget(data.commands[1], target);
}

export function expectedPredictManagerOracleHints() {
  return [
    {
      id: predictDeploymentConfig.predictObjectId,
      kind: 'predict',
      label: 'Predict',
    },
    {
      id: ptbManagerId,
      kind: 'manager',
      label: 'PredictManager',
    },
    {
      id: ptbOracleId,
      kind: 'oracle',
      label: 'OracleSVI',
    },
  ];
}

function predictTradeMoveCall({
  actionFunction,
  objectOffset = 3,
  quantityInput = 6,
  typeArguments,
}: {
  actionFunction: 'mint' | 'mint_range' | 'redeem' | 'redeem_range';
  objectOffset?: number;
  quantityInput?: number;
  typeArguments: string[];
}) {
  return {
    $kind: 'MoveCall',
    MoveCall: {
      arguments: [
        { $kind: 'Input', Input: objectOffset, type: 'object' },
        { $kind: 'Input', Input: objectOffset + 1, type: 'object' },
        { $kind: 'Input', Input: objectOffset + 2, type: 'object' },
        { $kind: 'Result', Result: 0 },
        { $kind: 'Input', Input: quantityInput, type: 'pure' },
        { $kind: 'Input', Input: quantityInput + 1, type: 'object' },
      ],
      function: actionFunction,
      module: 'predict',
      package: predictDeploymentConfig.packageId,
      typeArguments,
    },
  };
}

function expectManagerOracleTradeInputs(
  data: TransactionData,
  {
    keyPureInputCount,
  }: {
    keyPureInputCount: 3 | 4;
  },
) {
  expect(data.inputs).toMatchObject([
    ...Array.from({ length: keyPureInputCount }, () => pureInput()),
    unresolvedPredictInput(),
    unresolvedInput(ptbManagerId),
    unresolvedInput(ptbOracleId),
    pureInput(),
    clockInput(),
  ]);
}

function unresolvedPredictInput() {
  return unresolvedInput(predictDeploymentConfig.predictObjectId);
}

function pureInput() {
  return { $kind: 'Pure' };
}

function unresolvedInput(objectId: ObjectId) {
  return {
    $kind: 'UnresolvedObject',
    UnresolvedObject: {
      objectId,
    },
  };
}

function clockInput() {
  return {
    $kind: 'Object',
    Object: {
      SharedObject: {
        initialSharedVersion: 1,
        mutable: false,
        objectId: '0x0000000000000000000000000000000000000000000000000000000000000006',
      },
    },
  };
}

function expectMoveCallTarget(command: TransactionCommand | undefined, target: string) {
  const moveCall = command?.MoveCall;
  expect(`${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`).toBe(target);
}
