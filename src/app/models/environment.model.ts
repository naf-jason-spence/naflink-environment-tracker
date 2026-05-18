export type EnvStatus = 'free' | 'occupied';
export type EnvGroup = 'qa' | 'uat';
export type PinnedField = 'branchOrRepo' | 'lockedBy';

export interface Environment {
  id: string;
  name: string;
  group: EnvGroup;
  branchOrRepo: string;
  status: EnvStatus;
  notes: string;
  lastUpdated: string | null;
  lockedBy: string;
  /** Fields listed here are hard-coded and cannot be edited or cleared. */
  pinned?: PinnedField[];
}
