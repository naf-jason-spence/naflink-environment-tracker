import {
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import {
  inject,
  Injectable,
} from '@angular/core';

import { Observable } from 'rxjs';

interface DispatchInputs {
  envId: string;
  action: 'free' | 'occupied';
  user: string;
  notes: string;
}

interface WorkflowDispatchRequest {
  ref: string;
  inputs: DispatchInputs;
}

const LS_TOKEN_KEY = 'envtracker.github.token';
const LS_OWNER_KEY = 'envtracker.github.owner';
const LS_REPO_KEY = 'envtracker.github.repo';
const LS_REF_KEY = 'envtracker.github.ref';

const DEFAULT_OWNER = 'NAF-Tech';
const DEFAULT_REPO = 'naflink-environment-tracker';
const DEFAULT_REF = 'develop';
const WORKFLOW_ID = 'mark-env.yml';

@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);

  dispatchMarkEnvironment(inputs: DispatchInputs): Observable<void> {
    const token = this.getToken();
    const owner = localStorage.getItem(LS_OWNER_KEY)?.trim() || DEFAULT_OWNER;
    const repo = localStorage.getItem(LS_REPO_KEY)?.trim() || DEFAULT_REPO;
    const ref = localStorage.getItem(LS_REF_KEY)?.trim() || DEFAULT_REF;

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_ID}/dispatches`;
    const body: WorkflowDispatchRequest = { ref, inputs };
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    });

    return this.http.post<void>(url, body, { headers });
  }

  private getToken(): string {
    const existing = localStorage.getItem(LS_TOKEN_KEY)?.trim();
    if (existing) return existing;

    const entered = window.prompt('Enter ENVTRACKER_DISPATCH_TOKEN (stored in this browser only):')?.trim();
    if (!entered) {
      throw new Error('A GitHub dispatch token is required to mark environments as free.');
    }

    localStorage.setItem(LS_TOKEN_KEY, entered);
    return entered;
  }
}
