import { Injectable, signal, computed, effect } from '@angular/core';
import { Environment } from '../models/environment.model';

const STORAGE_KEY = 'qa-tracker-environments';

const DEFAULT_ENVIRONMENTS: Environment[] = [
  { id: 'qa1',  name: 'QA',   group: 'qa',  branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'qa2',  name: 'QA2',  group: 'qa',  branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'qa3',  name: 'QA3',  group: 'qa',  branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'qa4',  name: 'QA4',  group: 'qa',  branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'qa5',  name: 'QA5',  group: 'qa',  branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'uat1', name: 'UAT',  group: 'uat', branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
  { id: 'uat2', name: 'UAT2', group: 'uat', branchOrRepo: '', status: 'free', notes: '', lastUpdated: null, lockedBy: '' },
];

function loadFromStorage(): Environment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw).map((e: any) => ({
        id: e.id,
        name: e.name,
        group: e.group ?? (e.id.startsWith('uat') ? 'uat' : 'qa'),
        branchOrRepo: e.branchOrRepo ?? e.branch ?? e.repo ?? '',
        status: e.status ?? 'free',
        notes: e.notes ?? '',
        lastUpdated: e.lastUpdated ?? null,
        lockedBy: e.lockedBy ?? '',
      }));
    }
  } catch {}
  return DEFAULT_ENVIRONMENTS;
}

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  readonly environments = signal<Environment[]>(loadFromStorage());
  readonly occupiedCount = computed(() => this.environments().filter(e => e.status === 'occupied').length);
  readonly freeCount = computed(() => this.environments().filter(e => e.status === 'free').length);
  readonly total = computed(() => this.environments().length);

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.environments())));
  }

  update(id: string, changes: Partial<Environment>): void {
    this.environments.update(envs =>
      envs.map(env => env.id === id ? { ...env, ...changes, lastUpdated: new Date().toISOString() } : env)
    );
  }

  clear(id: string): void {
    this.environments.update(envs =>
      envs.map(env => env.id === id
        ? { ...env, branchOrRepo: '', status: 'free', notes: '', lockedBy: '', lastUpdated: new Date().toISOString() }
        : env)
    );
  }

  resetAll(): void {
    this.environments.set(DEFAULT_ENVIRONMENTS.map(e => ({ ...e })));
  }
}
