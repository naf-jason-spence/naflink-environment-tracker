import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  AdoBuildSummary,
  AdoConfig,
  AdoDefinitionMapping,
  AdoDeploymentStatus,
  AdoReleaseDefinitionMapping,
  AdoReleaseSummary,
} from '../models/ado.model';
import { Environment } from '../models/environment.model';
import { AdoService } from './ado.service';

const STORAGE_KEY = 'qa-tracker-environments';
/** Stores org + project only — PAT is intentionally excluded. */
const ADO_SETTINGS_KEY = 'qa-tracker-ado-settings';
/** Stores env→definition mappings. No credentials. */
const ADO_MAPPINGS_KEY = 'qa-tracker-ado-mappings';
/** PAT lives in sessionStorage only — cleared when the tab closes. */
const ADO_PAT_SESSION_KEY = 'qa-tracker-ado-pat';

const DEFAULT_ENVIRONMENTS: Environment[] = [
  { id: 'qa1',  name: 'QA',   group: 'qa',  branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'qa2',  name: 'QA2',  group: 'qa',  branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'qa3',  name: 'QA3',  group: 'qa',  branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'qa4',  name: 'QA4',  group: 'qa',  branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'qa5',  name: 'QA5',  group: 'qa',  branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'uat1', name: 'UAT',  group: 'uat', branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
  { id: 'uat2', name: 'UAT2', group: 'uat', branchOrRepo: '', lockedBy: '', status: 'free', notes: '', lastUpdated: null },
];

function loadFromStorage(): Environment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Environment[];
  } catch {}
  return DEFAULT_ENVIRONMENTS.map(e => ({ ...e }));
}

function loadAdoMappings(): AdoReleaseDefinitionMapping[] {
  try {
    const raw = localStorage.getItem(ADO_MAPPINGS_KEY);
    return raw ? (JSON.parse(raw) as AdoReleaseDefinitionMapping[]) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly adoService = inject(AdoService);

  readonly environments = signal<Environment[]>(loadFromStorage());
  readonly occupiedCount = computed(() => this.environments().filter(e => e.status === 'occupied').length);
  readonly freeCount = computed(() => this.environments().filter(e => e.status === 'free').length);
  readonly total = computed(() => this.environments().length);

  // ── ADO sync state ─────────────────────────────────────────────────────────
  /**
   * True when running on GitHub Pages (any host other than localhost / 127.0.0.1).
   * Used to switch between the static JSON sync (production) and direct ADO
   * API calls (local development).
   */
  readonly isProduction: boolean =
    typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname);

  readonly adoLoading = signal(false);
  readonly adoError = signal<string | null>(null);
  readonly adoLastSynced = signal<string | null>(null);
  readonly adoMappings = signal<AdoReleaseDefinitionMapping[]>(loadAdoMappings());
  /** Latest CI build from ado-status.json (production only). Not per-environment. */
  readonly latestBuild = signal<AdoBuildSummary | null>(null);

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.environments())));

    // On GitHub Pages: auto-populate from the pre-generated JSON — no PAT required.
    if (this.isProduction) {
      this.syncFromStatusJson();
    }
  }

  // ── ADO configuration ──────────────────────────────────────────────────────

  /**
   * Persist org + project to localStorage.
   * The PAT is stored separately in sessionStorage via `saveAdoPat()`.
   */
  saveAdoSettings(organization: string, project: string): void {
    localStorage.setItem(ADO_SETTINGS_KEY, JSON.stringify({ organization, project }));
  }

  /**
   * Persist the PAT to sessionStorage only — it is never written to
   * localStorage so it cannot be exfiltrated from disk-level storage.
   */
  saveAdoPat(pat: string): void {
    sessionStorage.setItem(ADO_PAT_SESSION_KEY, pat);
  }

  /** Persist the env→release definition+stage mappings (no credentials). */
  setAdoMappings(mappings: AdoReleaseDefinitionMapping[]): void {
    this.adoMappings.set(mappings);
    localStorage.setItem(ADO_MAPPINGS_KEY, JSON.stringify(mappings));
  }

  /**
   * Reads org, project, and PAT from storage and returns a complete
   * `AdoConfig`, or `null` if any piece is missing.
   */
  getAdoConfig(): AdoConfig | null {
    try {
      const settings = localStorage.getItem(ADO_SETTINGS_KEY);
      const pat = sessionStorage.getItem(ADO_PAT_SESSION_KEY);
      if (!settings || !pat) return null;
      const { organization, project } = JSON.parse(settings) as { organization: string; project: string };
      if (!organization || !project) return null;
      return { organization, project, pat };
    } catch {
      return null;
    }
  }

  // ── ADO sync ───────────────────────────────────────────────────────────────

  /**
   * Fires parallel requests for every configured mapping, then merges the
   * returned build data into the environment signals.
   *
   * - `branchOrRepo` is populated from `sourceBranch` (pinned fields are
   *   always protected).
   * - `lockedBy` is populated from `requestedFor` when not pinned.
   * - All ADO-enriched fields (`adoBuildId`, `adoBuildNumber`, etc.) are
   *   updated unconditionally.
   */
  /**
   * Reads docs/ado-status.json (written by GitHub Actions) and applies the
   * latest build to every environment. Used in production only.
   */
  syncFromStatusJson(): void {
    this.adoLoading.set(true);
    this.adoError.set(null);

    this.adoService.syncFromJson().subscribe({
      next: (status) => {
        if (!status.latestBuild && !status.environments) {
          this.adoError.set('ADO status not yet available — the sync workflow may not have run yet.');
          this.adoLoading.set(false);
          return;
        }

        if (status.latestBuild) {
          this.latestBuild.set(status.latestBuild);
        }

        // If the workflow captured per-environment stage data, use it.
        const envMap = status.environments;
        if (envMap && Object.keys(envMap).length > 0) {
          // Normalize a string: lowercase, remove spaces, hyphens, underscores,
          // and strip common noise words so "Deploy to QA3" → "qa3".
          const normalize = (s: string) =>
            s.toLowerCase()
              .replace(/\bdeployto\b|\bdeploy\b|\bto\b|\bstage\b|\benv\b|\benvironment\b/g, '')
              .replace(/[\s\-_]/g, '');

          const deployMap = new Map<string, AdoReleaseSummary>();
          for (const env of this.environments()) {
            const normEnv = normalize(env.name);
            // 1. Exact normalized match, 2. stage contains env name, 3. env name contains stage
            const stageName = Object.keys(envMap).find(k => {
              const normStage = normalize(k);
              return normStage === normEnv || normStage.includes(normEnv) || normEnv.includes(normStage);
            });
            if (stageName) {
              const d = envMap[stageName];
              deployMap.set(env.id, {
                releaseId:        d.releaseId ?? 0,
                releaseName:      d.releaseName ?? '',
                sourceBranch:     d.sourceBranch,
                buildNumber:      d.buildNumber ?? '',
                deployedBy:       d.deployedBy,
                startedOn:        d.deployedOn ?? d.finishTime ?? null,
                deploymentStatus: d.status as AdoDeploymentStatus,
                environmentName:  stageName,
              });
            }
          }
          if (deployMap.size > 0) {
            this.applyAdoDeployments(deployMap);
            return;
          }
        }

        // Fall back: apply the latest CI build to all cards (same data everywhere).
        if (status.latestBuild) {
          const buildMap = new Map<string, AdoBuildSummary>(
            this.environments().map(env => [env.id, status.latestBuild!]),
          );
          this.applyAdoBuilds(buildMap);
        } else {
          this.adoLoading.set(false);
        }
      },
      error: (err: Error) => {
        this.adoError.set(err?.message ?? 'Failed to load ADO status');
        this.adoLoading.set(false);
      },
    });
  }

  syncFromAdo(): void {
    const config = this.getAdoConfig();
    const mappings = this.adoMappings();

    if (!config) {
      this.adoError.set('ADO configuration incomplete — call saveAdoSettings() and saveAdoPat() first.');
      return;
    }
    if (!mappings.length) {
      this.adoError.set('No pipeline mappings configured. Open ADO Settings to map your build pipelines.');
      return;
    }

    this.adoLoading.set(true);
    this.adoError.set(null);

    // releaseEnvironmentId === 0 means the mapping is a build/YAML pipeline.
    // releaseEnvironmentId  > 0 means it is a classic release pipeline with a stage.
    const isBuildOnly = mappings.every(m => m.releaseEnvironmentId === 0);

    if (isBuildOnly) {
      const buildMappings: AdoDefinitionMapping[] = mappings.map(m => ({
        envId:        m.envId,
        definitionId: m.releaseDefinitionId,
      }));
      this.adoService.syncAllBuilds(config, buildMappings).subscribe({
        next:  (buildMap) => this.applyAdoBuilds(buildMap),
        error: (err: Error) => {
          this.adoError.set(err?.message ?? 'ADO sync failed');
          this.adoLoading.set(false);
        },
      });
    } else {
      this.adoService.syncAllDeployments(config, mappings).subscribe({
        next:  (deployMap) => this.applyAdoDeployments(deployMap),
        error: (err: Error) => {
          this.adoError.set(err?.message ?? 'ADO sync failed');
          this.adoLoading.set(false);
        },
      });
    }
  }

  private applyAdoBuilds(buildMap: Map<string, AdoBuildSummary>): void {
    this.environments.update(envs =>
      envs.map(env => {
        const build = buildMap.get(env.id);
        if (!build) return env;

        // Map build status/result to the shared AdoDeploymentStatus vocabulary
        let deployStatus: 'inProgress' | 'succeeded' | 'partiallySucceeded' | 'failed' | 'notDeployed';
        if (build.status === 'inProgress' || build.status === 'cancelling') {
          deployStatus = 'inProgress';
        } else {
          switch (build.result) {
            case 'succeeded':          deployStatus = 'succeeded';          break;
            case 'partiallySucceeded': deployStatus = 'partiallySucceeded'; break;
            case 'failed':             // fall-through
            case 'canceled':           deployStatus = 'failed';             break;
            default:                   deployStatus = 'notDeployed';
          }
        }

        return {
          ...env,
          branchOrRepo:        build.sourceBranch,
          lockedBy:            build.requestedFor,
          status:              (build.sourceBranch || build.requestedFor) ? 'occupied' : env.status,
          adoReleaseId:        build.buildId,
          adoReleaseName:      build.definitionName,
          adoBuildNumber:      build.buildNumber,
          adoDeploymentStatus: deployStatus,
          adoDeployedBy:       build.requestedFor,
          adoStartedOn:        build.startTime,
          lastUpdated:         new Date().toISOString(),
        };
      })
    );
    this.adoLastSynced.set(new Date().toISOString());
    this.adoLoading.set(false);
  }

  private applyAdoDeployments(deployMap: Map<string, AdoReleaseSummary>): void {
    this.environments.update(envs =>
      envs.map(env => {
        const release = deployMap.get(env.id);
        if (!release) return env;

        return {
          ...env,
          branchOrRepo:        release.sourceBranch,
          lockedBy:            release.deployedBy,
          status:              (release.sourceBranch || release.deployedBy) ? 'occupied' : env.status,
          adoReleaseId:        release.releaseId,
          adoReleaseName:      release.releaseName,
          adoBuildNumber:      release.buildNumber,
          adoDeploymentStatus: release.deploymentStatus,
          adoDeployedBy:       release.deployedBy,
          adoStartedOn:        release.startedOn,
          lastUpdated:         new Date().toISOString(),
        };
      })
    );
    this.adoLastSynced.set(new Date().toISOString());
    this.adoLoading.set(false);
  }
}
