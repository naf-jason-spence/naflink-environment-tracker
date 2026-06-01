import {
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import {
  inject,
  Injectable,
} from '@angular/core';

import {
  defer,
  Observable,
} from 'rxjs';

interface DispatchInputs {
  envId: string;
  action: 'free' | 'occupied';
  user: string;
  notes: string;
  branchOrRepo?: string;
}

interface WorkflowDispatchRequest {
  ref: string;
  inputs: DispatchInputs;
}

interface EnvTrackerRuntimeConfig {
  dispatchToken?: string;
  owner?: string;
  repo?: string;
  ref?: string;
}

type DispatchTokenSource = 'runtime-config' | 'local-storage' | 'window-global' | 'missing';

export interface DispatchDebugInfo {
  owner: string;
  repo: string;
  ref: string;
  workflowId: string;
  dispatchUrl: string;
  tokenConfigured: boolean;
  tokenSource: DispatchTokenSource;
}

const LS_TOKEN_KEY = 'envtracker.github.token';
const LS_OWNER_KEY = 'envtracker.github.owner';
const LS_REPO_KEY = 'envtracker.github.repo';
const LS_REF_KEY = 'envtracker.github.ref';

const DEFAULT_OWNER = 'naf-jason-spence';
const DEFAULT_REPO = 'naflink-environment-tracker';
const DEFAULT_REF = 'develop';
const WORKFLOW_ID = 'mark-env.yml';

@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);

  private get runtimeConfig(): EnvTrackerRuntimeConfig {
    return (window as Window & { __ENVTRACKER_CONFIG__?: EnvTrackerRuntimeConfig }).__ENVTRACKER_CONFIG__ ?? {};
  }

  dispatchMarkEnvironment(inputs: DispatchInputs): Observable<void> {
    return defer(() => {
      const token = this.getToken();
      const { owner, repo, ref } = this.resolveDispatchConfig();

      const url = this.getDispatchUrl(owner, repo);
      const body: WorkflowDispatchRequest = { ref, inputs };
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      });
  
      return this.http.post<void>(url, body, { headers });
    });
  }

  getDispatchDebugInfo(): DispatchDebugInfo {
    const { owner, repo, ref } = this.resolveDispatchConfig();
    const tokenSource = this.getTokenSource();

    return {
      owner,
      repo,
      ref,
      workflowId: WORKFLOW_ID,
      dispatchUrl: this.getDispatchUrl(owner, repo),
      tokenConfigured: tokenSource !== 'missing',
      tokenSource,
    };
  }

  private resolveDispatchConfig(): { owner: string; repo: string; ref: string } {
    return {
      owner: this.runtimeConfig.owner?.trim() || localStorage.getItem(LS_OWNER_KEY)?.trim() || DEFAULT_OWNER,
      repo: this.runtimeConfig.repo?.trim() || localStorage.getItem(LS_REPO_KEY)?.trim() || DEFAULT_REPO,
      ref: this.runtimeConfig.ref?.trim() || localStorage.getItem(LS_REF_KEY)?.trim() || DEFAULT_REF,
    };
  }

  private getDispatchUrl(owner: string, repo: string): string {
    return `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_ID}/dispatches`;
  }

  private getTokenSource(): DispatchTokenSource {
    if (this.runtimeConfig.dispatchToken?.trim()) return 'runtime-config';
    if (localStorage.getItem(LS_TOKEN_KEY)?.trim()) return 'local-storage';
    if ((window as Window & { __ENVTRACKER_DISPATCH_TOKEN__?: string }).__ENVTRACKER_DISPATCH_TOKEN__?.trim()) {
      return 'window-global';
    }
    return 'missing';
  }

  private getToken(): string {
    const configuredToken = this.runtimeConfig.dispatchToken?.trim();
    if (configuredToken) return configuredToken;

    const localToken = localStorage.getItem(LS_TOKEN_KEY)?.trim();
    if (localToken) return localToken;

    const globalToken = (window as Window & { __ENVTRACKER_DISPATCH_TOKEN__?: string })
      .__ENVTRACKER_DISPATCH_TOKEN__
      ?.trim();
    if (globalToken) return globalToken;

    throw new Error(
      "Dispatch token is not configured. Set window.__ENVTRACKER_CONFIG__.dispatchToken, localStorage key 'envtracker.github.token', or window.__ENVTRACKER_DISPATCH_TOKEN__."
    );
  }
}
