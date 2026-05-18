/** Per-environment release deployment record from ado-status.json. */
export interface AdoEnvDeployment {
  sourceBranch: string;
  deployedBy: string;
  status: string;
  deployedOn: string | null;
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

/** Credentials and target project for an Azure DevOps instance. */
export interface AdoConfig {
  organization: string;
  project: string;
  /**
   * Personal Access Token.
   * Stored in sessionStorage only — never written to localStorage / disk.
   * Required scope: Release (read).
   */
  pat: string;
}

/** Maps a local environment slot to an ADO release pipeline stage. */
export interface AdoReleaseDefinitionMapping {
  /** Local environment ID, e.g. 'qa1' */
  envId: string;
  /**
   * ADO release definition ID.
   * Found in the URL: Pipelines → Releases → select a pipeline → URL contains ?definitionId=N
   */
  releaseDefinitionId: number;
  /**
   * ADO release environment (stage) ID within the definition.
   * Found in the URL when you click Edit on a stage: ?environmentId=N
   */
  releaseEnvironmentId: number;
}

/** @deprecated Use AdoReleaseDefinitionMapping. Kept for backwards-compatibility during migration. */
export interface AdoDefinitionMapping {
  envId: string;
  definitionId: number;
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

/** Normalised deployment record from the ADO Release Management API. */
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

// ── Raw ADO REST API response shapes ────────────────────────────────────────

export interface AdoBuildListResponse {
  count: number;
  value: AdoApiBuild[];
}

export interface AdoApiBuild {
  id: number;
  buildNumber: string;
  status: AdoBuildStatus;
  result: AdoBuildResult;
  sourceBranch: string;
  sourceVersion: string;
  requestedFor: { displayName: string };
  startTime: string;
  finishTime: string | null;
  definition: { id: number; name: string };
}

export interface AdoDeploymentListResponse {
  count: number;
  value: AdoApiDeployment[];
}

export interface AdoApiDeployment {
  release: {
    id: number;
    name: string;
    artifacts: Array<{
      definitionReference: {
        branch: { id: string; name: string };
        version: { id: string; name: string };
      };
    }>;
  };
  releaseEnvironment: { id: number; name: string };
  requestedBy: { displayName: string };
  startedOn: string | null;
  deploymentStatus: AdoDeploymentStatus;
}

// ── Discovery shapes (used by the settings panel) ────────────────────────────

/** A release pipeline definition with its stages, populated via the discovery call. */
export interface AdoReleaseDefOption {
  id: number;
  name: string;
  stages: AdoReleaseStageOption[];
}

/** A stage (environment) within a release pipeline definition. */
export interface AdoReleaseStageOption {
  id: number;
  name: string;
}
