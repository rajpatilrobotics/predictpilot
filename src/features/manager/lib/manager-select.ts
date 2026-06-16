import type { PredictPilotError } from '@/lib/errors';
import type { ObjectId, SuiAddress } from '@/types/predict';
import type { PredictManagerCreatedModel } from '@/types/portfolio';

export type PredictManagerDiscoveryStatus =
  | 'AMBIGUOUS'
  | 'ERROR'
  | 'NO_MANAGER'
  | 'NO_WALLET'
  | 'READY';

export type PredictManagerDiscoveryWarningCode = 'INDEXED_OWNER_ONLY';

export interface PredictManagerDiscoveryWarning {
  code: PredictManagerDiscoveryWarningCode;
  message: string;
}

interface PredictManagerSelectionBase {
  manager: PredictManagerCreatedModel | null;
  managerId: ObjectId | null;
  matchingManagers: PredictManagerCreatedModel[];
  owner: SuiAddress | null;
  status: PredictManagerDiscoveryStatus;
  warnings: PredictManagerDiscoveryWarning[];
}

export type PredictManagerSelection =
  | (PredictManagerSelectionBase & {
      manager: null;
      managerId: null;
      status: 'NO_WALLET';
    })
  | (PredictManagerSelectionBase & {
      manager: null;
      managerId: null;
      owner: SuiAddress;
      status: 'NO_MANAGER';
    })
  | (PredictManagerSelectionBase & {
      manager: PredictManagerCreatedModel;
      managerId: ObjectId;
      owner: SuiAddress;
      status: 'READY';
    })
  | (PredictManagerSelectionBase & {
      manager: null;
      managerId: null;
      owner: SuiAddress;
      status: 'AMBIGUOUS';
    })
  | (PredictManagerSelectionBase & {
      error: PredictPilotError;
      manager: null;
      managerId: null;
      status: 'ERROR';
    });

export interface SelectPredictManagerForOwnerOptions {
  error?: PredictPilotError;
  managers: readonly PredictManagerCreatedModel[];
  owner: SuiAddress | null | undefined;
}

const INDEXED_OWNER_WARNING: PredictManagerDiscoveryWarning = {
  code: 'INDEXED_OWNER_ONLY',
  message:
    'Manager ownership is currently derived from indexed server data; wallet-critical execution still needs future pre-sign owner validation.',
};

export function selectPredictManagerForOwner({
  error,
  managers,
  owner,
}: SelectPredictManagerForOwnerOptions): PredictManagerSelection {
  const normalizedOwner = owner ?? null;

  if (error !== undefined) {
    return {
      error,
      manager: null,
      managerId: null,
      matchingManagers: [],
      owner: normalizedOwner,
      status: 'ERROR',
      warnings: [],
    };
  }

  if (normalizedOwner === null) {
    return {
      manager: null,
      managerId: null,
      matchingManagers: [],
      owner: null,
      status: 'NO_WALLET',
      warnings: [],
    };
  }

  const matchingManagers = managers.filter((manager) =>
    areSameSuiAddress(manager.owner, normalizedOwner),
  );

  if (matchingManagers.length === 0) {
    return {
      manager: null,
      managerId: null,
      matchingManagers,
      owner: normalizedOwner,
      status: 'NO_MANAGER',
      warnings: [],
    };
  }

  if (matchingManagers.length > 1) {
    return {
      manager: null,
      managerId: null,
      matchingManagers,
      owner: normalizedOwner,
      status: 'AMBIGUOUS',
      warnings: [INDEXED_OWNER_WARNING],
    };
  }

  const [manager] = matchingManagers;

  return {
    manager,
    managerId: manager.managerId,
    matchingManagers,
    owner: normalizedOwner,
    status: 'READY',
    warnings: [INDEXED_OWNER_WARNING],
  };
}

function areSameSuiAddress(left: SuiAddress, right: SuiAddress) {
  return left.toLowerCase() === right.toLowerCase();
}
