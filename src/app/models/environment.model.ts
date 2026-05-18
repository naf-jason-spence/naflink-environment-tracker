import { AdoDeploymentStatus } from './ado.model';

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

  // ── ADO-enriched fields (optional; populated via AdoService.syncAllDeployments) ──
  /** ADO release record ID. */
  adoReleaseId?: number;
  /** Human-readable release name, e.g. 'Release-42'. */
  adoReleaseName?: string;
  /** Build number of the artifact attached to this release, e.g. '20250518.3'. */
  adoBuildNumber?: string;
  /** Deployment status for this environment's stage. */
  adoDeploymentStatus?: AdoDeploymentStatus;
  /** displayName of whoever triggered the deployment. */
  adoDeployedBy?: string;
  /** ISO timestamp of when the deployment to this environment started. */
  adoStartedOn?: string | null;
  /**
   * ISO timestamp set when a user manually marks this env as free.
   * Cleared automatically when a newer ADO deployment arrives on sync.
   */
  freedAt?: string | null;
}

