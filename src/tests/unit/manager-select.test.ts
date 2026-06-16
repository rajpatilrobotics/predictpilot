import { describe, expect, it } from 'vitest';
import { createAppError } from '@/lib/errors';
import { selectPredictManagerForOwner } from '@/features/manager/lib/manager-select';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { PredictManagerCreatedModel } from '@/types/portfolio';

const owner = '0x195b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756c' as SuiAddress;
const otherOwner =
  '0x295b8d58415745c17c2877478818c44b8c41172c9d16282a76ea6e3582db756d' as SuiAddress;
const managerId = '0x640e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b3' as ObjectId;
const secondManagerId =
  '0x740e9ab9bdd5c68e57ddf293260ed319abf85ea0d6d0da076952de023fe961b4' as ObjectId;

function managerCreated({
  managerId: id,
  owner: managerOwner,
}: {
  managerId: ObjectId;
  owner: SuiAddress;
}): PredictManagerCreatedModel {
  return {
    checkpoint: 349_210_521n,
    checkpointTimestampMs: 1_781_634_000_000n,
    digest: 'manager-digest',
    eventDigest: 'manager-event',
    eventIndex: 0,
    managerId: id,
    owner: managerOwner,
    packageId: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
    sender: managerOwner,
    txIndex: 0,
  };
}

describe('selectPredictManagerForOwner', () => {
  it('returns NO_WALLET when no wallet owner is available', () => {
    const result = selectPredictManagerForOwner({
      managers: [managerCreated({ managerId, owner })],
      owner: null,
    });

    expect(result).toMatchObject({
      manager: null,
      managerId: null,
      owner: null,
      status: 'NO_WALLET',
    });
  });

  it('returns NO_MANAGER when no indexed manager belongs to the owner', () => {
    const result = selectPredictManagerForOwner({
      managers: [managerCreated({ managerId, owner: otherOwner })],
      owner,
    });

    expect(result).toMatchObject({
      manager: null,
      managerId: null,
      matchingManagers: [],
      owner,
      status: 'NO_MANAGER',
    });
  });

  it('returns READY when exactly one manager belongs to the owner', () => {
    const result = selectPredictManagerForOwner({
      managers: [managerCreated({ managerId, owner })],
      owner,
    });

    expect(result).toMatchObject({
      managerId,
      owner,
      status: 'READY',
      warnings: [
        {
          code: 'INDEXED_OWNER_ONLY',
        },
      ],
    });
    expect(result.matchingManagers).toHaveLength(1);
  });

  it('matches owner addresses case-insensitively', () => {
    const result = selectPredictManagerForOwner({
      managers: [managerCreated({ managerId, owner })],
      owner: owner.toUpperCase() as SuiAddress,
    });

    expect(result).toMatchObject({
      managerId,
      status: 'READY',
    });
  });

  it('returns AMBIGUOUS when multiple managers belong to the owner', () => {
    const result = selectPredictManagerForOwner({
      managers: [
        managerCreated({ managerId, owner }),
        managerCreated({ managerId: secondManagerId, owner }),
      ],
      owner,
    });

    expect(result).toMatchObject({
      manager: null,
      managerId: null,
      owner,
      status: 'AMBIGUOUS',
      warnings: [
        {
          code: 'INDEXED_OWNER_ONLY',
        },
      ],
    });
    expect(result.matchingManagers).toHaveLength(2);
  });

  it('can represent normalized manager discovery errors', () => {
    const error = createAppError('PREDICT_SERVER_UNAVAILABLE');

    const result = selectPredictManagerForOwner({
      error,
      managers: [],
      owner,
    });

    expect(result).toMatchObject({
      error,
      manager: null,
      status: 'ERROR',
    });
  });
});
