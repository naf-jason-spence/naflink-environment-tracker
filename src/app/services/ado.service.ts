import { DOCUMENT } from '@angular/common';
import {
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import {
  inject,
  Injectable,
} from '@angular/core';

import {
  forkJoin,
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  map,
} from 'rxjs/operators';

import {
  AdoBuildListResponse,
  AdoBuildSummary,
  AdoConfig,
  AdoDefinitionMapping,
  AdoDeploymentListResponse,
  AdoEnvDeployment,
  AdoReleaseDefinitionMapping,
  AdoReleaseDefOption,
  AdoReleaseSummary,
  AdoStatusJson,
} from '../models/ado.model';

const ADO_API_VERSION = '7.1';

@Injectable({ providedIn: 'root' })
export class AdoService {
  private readonly http     = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  // -- Static JSON (GitHub Pages production) --------------------------------

  /**
   * Reads the pre-generated ado-status.json produced by the GitHub Actions
   * ado-sync workflow. Used in production (GitHub Pages) where direct ADO
   * API calls are blocked by CORS.
   * URL is resolved relative to the app's base href so it works under any
   * sub-path (e.g. /naflink-environment-tracker/).
   */
  syncFromJson(): Observable<AdoStatusJson> {
    const url = `${this.document.baseURI}ado-status.json`;
    return this.http
      .get<AdoStatusJson>(url)
      .pipe(
        catchError(() => of({ generatedAt: null, latestBuild: null })),
      );
  }

  // -- Release Deployments API (vsrm.dev.azure.com) -------------------------

  /**
   * Fetches all release pipeline definitions with their stages in ONE request
   * using `$expand=environments`. Used by the settings panel to populate
   * the pipeline/stage dropdowns without requiring the user to look up IDs.
   * Returns [] on any error so the UI can fall back to manual entry.
   */
  getReleasePipelinesWithStages(config: AdoConfig): Observable<AdoReleaseDefOption[]> {
    const { organization, project } = config;
    const url =
      `https://vsrm.dev.azure.com/${encodeURIComponent(organization)}` +
      `/${encodeURIComponent(project)}/_apis/release/definitions` +
      `?$expand=environments&api-version=${ADO_API_VERSION}`;

    return this.http
      .get<{ value: Array<{ id: number; name: string; environments: Array<{ id: number; name: string }> }> }>(
        url, { headers: this.buildHeaders(config.pat) },
      )
      .pipe(
        map(({ value }) =>
          value.map(def => ({
            id:     def.id,
            name:   def.name,
            stages: (def.environments ?? []).map(e => ({ id: e.id, name: e.name })),
          })),
        ),
        catchError(() => of([])),
      );
  }

  /**
   * Fetches the most-recent deployment for a specific release definition stage.
   * GET vsrm.dev.azure.com/{org}/{project}/_apis/release/deployments
   *   ?definitionId={id}&definitionEnvironmentId={stageId}&$top=1
   */
  getLatestDeployment(
    config: AdoConfig,
    releaseDefinitionId: number,
    releaseEnvironmentId: number,
  ): Observable<AdoReleaseSummary | null> {
    const { organization, project } = config;
    const url =
      `https://vsrm.dev.azure.com/${encodeURIComponent(organization)}` +
      `/${encodeURIComponent(project)}/_apis/release/deployments` +
      `?definitionId=${releaseDefinitionId}` +
      `&definitionEnvironmentId=${releaseEnvironmentId}` +
      `&$top=1&api-version=${ADO_API_VERSION}`;

    return this.http
      .get<AdoDeploymentListResponse>(url, { headers: this.buildHeaders(config.pat) })
      .pipe(
        map(({ value }) => {
          if (!value.length) return null;
          const d = value[0];
          const artifact = d.release.artifacts?.[0];
          return {
            releaseId:        d.release.id,
            releaseName:      d.release.name,
            sourceBranch:     artifact?.definitionReference?.branch?.id?.replace(/^refs\/heads\//, '') ?? '',
            buildNumber:      artifact?.definitionReference?.version?.name ?? '',
            deployedBy:       d.requestedBy?.displayName ?? '',
            startedOn:        d.startedOn ?? null,
            deploymentStatus: d.deploymentStatus,
            environmentName:  d.releaseEnvironment?.name ?? '',
          } satisfies AdoReleaseSummary;
        }),
        catchError(() => of(null)),
      );
  }

  /**
   * Fetches the latest deployment for every release mapping in parallel.
   * Returns a Map<envId, AdoReleaseSummary> — omits entries with no deployment.
   */
  syncAllDeployments(
    config: AdoConfig,
    mappings: AdoReleaseDefinitionMapping[],
  ): Observable<Map<string, AdoReleaseSummary>> {
    if (!mappings.length) return of(new Map<string, AdoReleaseSummary>());

    const requests$ = mappings.map(({ envId, releaseDefinitionId, releaseEnvironmentId }) =>
      this.getLatestDeployment(config, releaseDefinitionId, releaseEnvironmentId).pipe(
        map(summary => ({ envId, summary })),
      ),
    );

    return forkJoin(requests$).pipe(
      map(results => {
        const deployMap = new Map<string, AdoReleaseSummary>();
        for (const { envId, summary } of results) {
          if (summary) deployMap.set(envId, summary);
        }
        return deployMap;
      }),
    );
  }

  // -- Build API (dev.azure.com) -- kept for local dev fallback -------------

  /**
   * Lists all build pipeline definitions (YAML / multi-stage pipelines).
   * Used by the settings panel for discovery when the team uses YAML pipelines
   * rather than classic release pipelines.
   * Returns [] on any error so the UI can fall back to manual entry.
   */
  getBuildPipelines(config: AdoConfig): Observable<{ id: number; name: string }[]> {
    const { organization, project } = config;
    const url =
      `https://dev.azure.com/${encodeURIComponent(organization)}` +
      `/${encodeURIComponent(project)}/_apis/build/definitions` +
      `?api-version=${ADO_API_VERSION}`;

    return this.http
      .get<{ value: Array<{ id: number; name: string }> }>(url, { headers: this.buildHeaders(config.pat) })
      .pipe(
        map(({ value }) => value.map(d => ({ id: d.id, name: d.name }))),
        catchError(() => of([])),
      );
  }

  /**
   * Fetches the single most-recent build for the given definition ID.
   * Returns null if no builds exist or if the request fails.
   */
  getLatestBuild(
    config: AdoConfig,
    definitionId: number,
  ): Observable<AdoBuildSummary | null> {
    const { organization, project } = config;
    const url =
      `https://dev.azure.com/${encodeURIComponent(organization)}` +
      `/${encodeURIComponent(project)}/_apis/build/builds` +
      `?definitions=${definitionId}&$top=1&api-version=${ADO_API_VERSION}`;

    return this.http
      .get<AdoBuildListResponse>(url, { headers: this.buildHeaders(config.pat) })
      .pipe(
        map(({ value }) => {
          if (!value.length) return null;
          const b = value[0];
          return {
            buildId:        b.id,
            buildNumber:    b.buildNumber,
            sourceBranch:   b.sourceBranch.replace(/^refs\/heads\//, ''),
            commitSha:      b.sourceVersion,
            status:         b.status,
            result:         b.result,
            requestedFor:   b.requestedFor?.displayName ?? '',
            startTime:      b.startTime,
            finishTime:     b.finishTime ?? null,
            definitionName: b.definition.name,
          } satisfies AdoBuildSummary;
        }),
        catchError(() => of(null)),
      );
  }

  syncAllBuilds(
    config: AdoConfig,
    mappings: AdoDefinitionMapping[],
  ): Observable<Map<string, AdoBuildSummary>> {
    if (!mappings.length) return of(new Map<string, AdoBuildSummary>());

    const requests$ = mappings.map(({ envId, definitionId }) =>
      this.getLatestBuild(config, definitionId).pipe(
        map(summary => ({ envId, summary })),
      ),
    );

    return forkJoin(requests$).pipe(
      map(results => {
        const buildMap = new Map<string, AdoBuildSummary>();
        for (const { envId, summary } of results) {
          if (summary) buildMap.set(envId, summary);
        }
        return buildMap;
      }),
    );
  }

  /**
   * Constructs the Authorization header for ADO PAT authentication.
   * Basic auth: empty username, PAT as password.
   */
  private buildHeaders(pat: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Basic ${btoa(`:${pat}`)}`,
    });
  }
}
