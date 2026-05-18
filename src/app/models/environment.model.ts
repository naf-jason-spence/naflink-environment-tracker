export type EnvStatus = 'free' | 'occupied';
export type EnvGroup = 'qa' | 'uat';

export interface Environment {
  id: string;
  name: string;
  group: EnvGroup;
  branchOrRepo: string;
  status: EnvStatus;
  notes: string;
  lastUpdated: string | null;
  lockedBy: string;
}
