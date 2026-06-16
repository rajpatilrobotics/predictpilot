import { describe, expect, it } from 'vitest';
import { predictDeploymentConfig } from '@/config/predict';
import { buildCreateManagerTx } from '@/integrations/deepbook-predict/tx/create-manager';
import { predictTxTargets } from '@/integrations/deepbook-predict/targets';
import type { SuiAddress } from '@/types/predict';

const sender =
  '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;

describe('buildCreateManagerTx', () => {
  it('builds one create-manager Move call from the target registry', () => {
    const result = buildCreateManagerTx({ sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const transactionData = result.transaction.getData();

    expect(transactionData).toMatchObject({
      commands: [
        {
          $kind: 'MoveCall',
          MoveCall: {
            arguments: [],
            function: 'create_manager',
            module: 'predict',
            package: predictDeploymentConfig.packageId,
            typeArguments: [],
          },
        },
      ],
      inputs: [],
    });
    const [createManagerCommand] = transactionData.commands;
    const moveCall = createManagerCommand?.MoveCall;
    const target = `${moveCall?.package}::${moveCall?.module}::${moveCall?.function}`;

    expect(target).toBe(predictTxTargets.predict.createManager);
  });

  it('returns a preview and execution request for later signing', () => {
    const result = buildCreateManagerTx({ sender });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.preview).toEqual({
      action: 'CREATE_MANAGER',
      affectedObjects: [
        {
          id: predictDeploymentConfig.predictObjectId,
          kind: 'predict',
          label: 'Predict',
        },
      ],
      description:
        'Create a PredictManager. The manager ID is resolved only after transaction confirmation.',
      expectedNetwork: 'testnet',
      managerIdResolution: 'after-confirmation',
      sender,
      target: predictTxTargets.predict.createManager,
      title: 'Create PredictManager',
    });
    expect(result.executionRequest).toMatchObject({
      action: 'CREATE_MANAGER',
      affectedObjects: result.preview.affectedObjects,
      description: result.preview.description,
      sender,
    });
    expect(result.executionRequest.transaction).toBe(result.transaction);
  });

  it('fails safely when no sender is connected', () => {
    const result = buildCreateManagerTx();

    expect(result).toMatchObject({
      error: {
        code: 'WALLET_NOT_CONNECTED',
        context: {
          action: 'CREATE_MANAGER',
          builder: 'buildCreateManagerTx',
        },
      },
      ok: false,
    });
  });
});
