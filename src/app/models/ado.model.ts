/** Per-environment release deployment record from ado-status.json. */
export interface AdoEnvDeployment {
  sourceBranch: string;
  deployedBy: string;
  status: string;
  deployedOn?: string | null;
  finishTime?: string | null;
  buildNumber?: string;
  releaseId: number | null;
  releaseName: string | null;
}

/** Shape of docs/ado-status.json written by the GitHub Actions workflow. */
export interface AdoStatusJson {
  generatedAt: string | null;
  latestBuild: AdoBuildSummary | null;
  /** Per-environment deployment data keyed by ADO stage name (e.g. "QA1", "UAT"). */
  environments?: Record<string, AdoEnvDeployment>;
  fetchError?: string;
}

// ── Status / result enums ────────────────────────────────────────────────────

export type AdoBuildStatus =
  | 'none'
  | 'inProgress'
  | 'completed'
  | 'cancelling'
  | 'postponed'
  | 'notStarted';

export type AdoBuildResult =
  | 'none'
  | 'succeeded'
  | 'partiallySucceeded'
  | 'failed'
  | 'canceled';

export type AdoDeploymentStatus =
  | 'all'
  | 'inProgress'
  | 'succeeded'
  | 'partiallySucceeded'
  | 'failed'
  | 'notDeployed';

// ── Normalised shapes surfaced to the rest of the app ───────────────────────

export interface AdoBuildSummary {
  buildId: number;
  buildNumber: string;
  /** Branch name with 'refs/heads/' prefix stripped. */
  sourceBranch: string;
  commitSha: string;
  status: AdoBuildStatus;
  result: AdoBuildResult;
  /** displayName of the person who queued the build. */
  requestedFor: string;
  startTime: string;
  finishTime: string | null;
  definitionName: string;
}

/** Normalised deployment record used by applyAdoDeployments. */
export interface AdoReleaseSummary {
  releaseId: number;
  releaseName: string;
  /** Branch name with 'refs/heads/' prefix stripped. */
  sourceBranch: string;
  /** Build number of the artifact attached to this release. */
  buildNumber: string;
  /** displayName of whoever triggered the deployment. */
  deployedBy: string;
  startedOn: string | null;
  deploymentStatus: AdoDeploymentStatus;
  environmentName: string;
}
