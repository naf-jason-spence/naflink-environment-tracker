import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  AdoBuildSummary,
  AdoDeploymentStatus,
  AdoReleaseSummary,
  EnvUserState,
} from '../models/ado.model';
import { Environment } from '../models/environment.model';
import { AdoService } from './ado.service';
import { GithubService } from './github.service';

const STORAGE_KEY = 'qa-tracker-environments';
const POLL_INTERVAL_MS = 60_000;

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

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly adoService = inject(AdoService);
  private readonly githubService = inject(GithubService);
  private dispatchErrorTimer: ReturnType<typeof setTimeout> | null = null;

  readonly environments = signal<Environment[]>(loadFromStorage());
  readonly pendingFreeIds = signal<Set<string>>(new Set());
  readonly dispatchPending = computed(() => this.pendingFreeIds().size > 0);
  readonly dispatchError = signal<string | null>(null);
  readonly occupiedCount = computed(() => this.environments().filter(e => e.status === 'occupied').length);
  readonly freeCount = computed(() => this.environments().filter(e => e.status === 'free').length);
  readonly total = computed(() => this.environments().length);

  // ── ADO sync state ─────────────────────────────────────────────────────────
  /**
   * True when running on GitHub Pages (any host other than localhost / 127.0.0.1).
   */
  readonly isProduction: boolean =
    typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname);

  readonly adoLoading = signal(false);
  readonly adoError = signal<string | null>(null);
  readonly adoLastSynced = signal<string | null>(null);
  /** Latest CI build from ado-status.json (production only). Not per-environment. */
  readonly latestBuild = signal<AdoBuildSummary | null>(null);

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.environments())));

    // On GitHub Pages: auto-populate from the pre-generated JSON.
    if (this.isProduction) {
      this.syncFromStatusJson();
      setInterval(() => this.syncFromStatusJson(), POLL_INTERVAL_MS);
    }
  }

  // ── ADO sync ───────────────────────────────────────────────────────────────

  /**
   * Reads docs/ado-status.json (written by GitHub Actions) and applies the
   * latest build to every environment.
   */
  syncFromStatusJson(): void {
    this.adoLoading.set(true);
    this.adoError.set(null);

    this.adoService.syncFromJson().subscribe({
      next: (status) => {
        if (!status.latestBuild && !status.environments && !status.userState) {
          this.adoError.set('ADO status not yet available — the sync workflow may not have run yet.');
          this.adoLoading.set(false);
          return;
        }

        if (status.latestBuild) {
          this.latestBuild.set(status.latestBuild);
        }

        // If the workflow captured per-environment stage data, use it.
        const envMap = status.environments;
        let adoApplied = false;
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
            // Exact normalized match only — substring matching caused 'qa2'/'qa3'/etc.
            // to incorrectly match 'QA' because 'qa2'.includes('qa') is true.
            const stageName = Object.keys(envMap).find(k => normalize(k) === normEnv);
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
            adoApplied = true;
          }
        }

        // Fall back: apply the latest CI build to all cards (same data everywhere).
        if (!adoApplied && status.latestBuild) {
          const buildMap = new Map<string, AdoBuildSummary>(
            this.environments().map(env => [env.id, status.latestBuild!]),
          );
          this.applyAdoBuilds(buildMap);
        }

        // Apply manual user overrides after ADO data is applied.
        this.applyUserState(status.userState ?? {});

        this.adoLastSynced.set(new Date().toISOString());
        this.adoLoading.set(false);
      },
      error: (err: Error) => {
        this.adoError.set(err?.message ?? 'Failed to load ADO status');
        this.adoLoading.set(false);
      },
    });
  }

  markAsFree(envId: string): void {
    const now = new Date().toISOString();

    this.dispatchError.set(null);
    this.clearDispatchErrorTimer();

    this.pendingFreeIds.update(prev => {
      const next = new Set(prev);
      next.add(envId);
      return next;
    });

    this.environments.update(envs =>
      envs.map(env =>
        env.id !== envId ? env : {
          ...env,
          status:              'free' as const,
          freedAt:             now,
          branchOrRepo:        '',
          lockedBy:            '',
          adoReleaseId:        undefined,
          adoReleaseName:      undefined,
          adoBuildNumber:      undefined,
          adoDeploymentStatus: undefined,
          adoDeployedBy:       undefined,
          adoStartedOn:        undefined,
          lastUpdated:         now,
        }
      )
    );

    const actor = this.getCurrentActor();
    this.githubService.dispatchMarkEnvironment({
      envId,
      action: 'free',
      user: actor,
      notes: '',
    }).subscribe({
      next: () => {
        this.refreshSoon();
        this.clearPendingFree(envId);
      },
      error: (err: unknown) => {
        this.clearPendingFree(envId);
        const message = this.getDispatchErrorMessage(err);
        this.dispatchError.set(message);
        this.scheduleDispatchErrorAutoClear();
      }
    });
  }

  isMarkingFree(envId: string): boolean {
    return this.pendingFreeIds().has(envId);
  }

  private applyAdoBuilds(buildMap: Map<string, AdoBuildSummary>): void {
    this.environments.update(envs =>
      envs.map(env => {
        const build = buildMap.get(env.id);
        if (!build) return env;

        // If the user manually freed this env after the last ADO deployment, keep it free.
        if (env.freedAt && build.startTime && build.startTime <= env.freedAt) return env;

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
          freedAt:             null,
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
  }

  private applyAdoDeployments(deployMap: Map<string, AdoReleaseSummary>): void {
    this.environments.update(envs =>
      envs.map(env => {
        const release = deployMap.get(env.id);
        if (!release) return env;

        // If the user manually freed this env after the last ADO deployment, keep it free.
        if (env.freedAt && release.startedOn && release.startedOn <= env.freedAt) return env;

        return {
          ...env,
          branchOrRepo:        release.sourceBranch,
          lockedBy:            release.deployedBy,
          status:              (release.sourceBranch || release.deployedBy) ? 'occupied' : env.status,
          freedAt:             null,
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
  }

  private applyUserState(userState: Record<string, EnvUserState>): void {
    if (!userState || Object.keys(userState).length === 0) return;

    this.environments.update(envs =>
      envs.map(env => {
        const override = userState[env.id];
        if (!override) return env;

        if (override.status === 'free') {
          const freedAt = override.freedAt ?? new Date().toISOString();

          // Ignore stale manual frees when a newer deployment has happened.
          if (env.adoStartedOn && freedAt <= env.adoStartedOn) {
            return env;
          }

          return {
            ...env,
            status: 'free',
            freedAt,
            notes: override.notes ?? env.notes,
            branchOrRepo: '',
            lockedBy: '',
            adoReleaseId: undefined,
            adoReleaseName: undefined,
            adoBuildNumber: undefined,
            adoDeploymentStatus: undefined,
            adoDeployedBy: undefined,
            adoStartedOn: undefined,
            lastUpdated: freedAt,
          };
        }

        return {
          ...env,
          status: 'occupied',
          freedAt: null,
          notes: override.notes ?? env.notes,
          branchOrRepo: override.branchOrRepo ?? env.branchOrRepo,
          lockedBy: override.lockedBy ?? override.freedBy ?? env.lockedBy,
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  }

  private refreshSoon(): void {
    setTimeout(() => this.syncFromStatusJson(), 5_000);
    setTimeout(() => this.syncFromStatusJson(), 20_000);
    setTimeout(() => this.syncFromStatusJson(), 45_000);
  }

  private clearPendingFree(envId: string): void {
    this.pendingFreeIds.update(prev => {
      const next = new Set(prev);
      next.delete(envId);
      return next;
    });
  }

  private scheduleDispatchErrorAutoClear(): void {
    this.clearDispatchErrorTimer();
    this.dispatchErrorTimer = setTimeout(() => {
      this.dispatchError.set(null);
      this.dispatchErrorTimer = null;
    }, 12_000);
  }

  private clearDispatchErrorTimer(): void {
    if (!this.dispatchErrorTimer) return;
    clearTimeout(this.dispatchErrorTimer);
    this.dispatchErrorTimer = null;
  }

  private getDispatchErrorMessage(err: unknown): string {
    const fallback = 'Failed to persist "Done / Free" to GitHub Actions. Local card is updated only.';

    if (!err || typeof err !== 'object') return fallback;
    const maybe = err as {
      status?: number;
      statusText?: string;
      message?: string;
      error?: { message?: string } | string;
    };

    const statusPart = maybe.status ? ` (${maybe.status}${maybe.statusText ? ` ${maybe.statusText}` : ''})` : '';
    const detail = typeof maybe.error === 'string'
      ? maybe.error
      : maybe.error?.message || maybe.message;

    return detail
      ? `GitHub dispatch failed${statusPart}: ${detail}`
      : `${fallback}${statusPart}`;
  }

  private getCurrentActor(): string {
    const key = 'envtracker.actor';
    const existing = localStorage.getItem(key)?.trim();
    if (existing) return existing;

    const entered = window.prompt('Enter your name for environment updates:')?.trim();
    if (!entered) return 'unknown';
    localStorage.setItem(key, entered);
    return entered;
  }
}
