import {
  computed,
  effect,
  Injectable,
  signal,
} from '@angular/core';

import { Environment } from '../models/environment.model';

const STORAGE_KEY = 'qa-tracker-environments';

const DEFAULT_ENVIRONMENTS: Environment[] = [
  { id: 'qa1',  name: 'QA',   group: 'qa',  branchOrRepo: 'develop',              lockedBy: '',              pinned: ['branchOrRepo'],             status: 'occupied', notes: '', lastUpdated: null },
  { id: 'qa2',  name: 'QA2',  group: 'qa',  branchOrRepo: '',                     lockedBy: '',                                                        status: 'free',     notes: '', lastUpdated: null },
  { id: 'qa3',  name: 'QA3',  group: 'qa',  branchOrRepo: 'ng-module migration',  lockedBy: 'Jason Spence',  pinned: ['branchOrRepo', 'lockedBy'],  status: 'occupied', notes: '', lastUpdated: null },
  { id: 'qa4',  name: 'QA4',  group: 'qa',  branchOrRepo: '',                     lockedBy: '',                                                        status: 'free',     notes: '', lastUpdated: null },
  { id: 'qa5',  name: 'QA5',  group: 'qa',  branchOrRepo: 'angular 21 upgrade',   lockedBy: 'Luis Castro',   pinned: ['branchOrRepo', 'lockedBy'],  status: 'occupied', notes: '', lastUpdated: null },
  { id: 'uat1', name: 'UAT',  group: 'uat', branchOrRepo: '',                     lockedBy: '',                                                        status: 'free',     notes: '', lastUpdated: null },
  { id: 'uat2', name: 'UAT2', group: 'uat', branchOrRepo: '',                     lockedBy: '',                                                        status: 'free',     notes: '', lastUpdated: null },
];

function loadFromStorage(): Environment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: any[] = JSON.parse(raw);
      return DEFAULT_ENVIRONMENTS.map(def => {
        const e = stored.find((s: any) => s.id === def.id) ?? {};
        const pinned = def.pinned ?? [];
        return {
          id: def.id,
          name: def.name,
          group: def.group,
          pinned: def.pinned,
          branchOrRepo: pinned.includes('branchOrRepo') ? def.branchOrRepo : (e.branchOrRepo ?? e.branch ?? e.repo ?? ''),
          lockedBy:     pinned.includes('lockedBy')     ? def.lockedBy     : (e.lockedBy ?? ''),
          status:       pinned.includes('branchOrRepo') ? 'occupied'        : (e.status ?? def.status),
          notes:        e.notes ?? '',
          lastUpdated:  e.lastUpdated ?? null,
        };
      });
    }
  } catch {}
  return DEFAULT_ENVIRONMENTS.map(e => ({ ...e }));
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
    const def = DEFAULT_ENVIRONMENTS.find(d => d.id === id);
    this.environments.update(envs =>
      envs.map(env => {
        if (env.id !== id) return env;
        const updated = { ...env, ...changes, lastUpdated: new Date().toISOString() };
        // Restore any pinned fields that must not be overwritten
        const pinned = def?.pinned ?? [];
        if (pinned.includes('branchOrRepo')) { updated.branchOrRepo = def!.branchOrRepo; updated.status = 'occupied'; }
        if (pinned.includes('lockedBy')) updated.lockedBy = def!.lockedBy;
        return updated;
      })
    );
  }

  clear(id: string): void {
    const def = DEFAULT_ENVIRONMENTS.find(d => d.id === id)!;
    const pinned = def.pinned ?? [];
    this.environments.update(envs =>
      envs.map(env => env.id === id
        ? {
            ...env,
            branchOrRepo: pinned.includes('branchOrRepo') ? def.branchOrRepo : '',
            lockedBy:     pinned.includes('lockedBy')     ? def.lockedBy     : '',
            status:       pinned.includes('branchOrRepo') ? 'occupied'        : 'free',
            notes: '',
            lastUpdated: new Date().toISOString(),
          }
        : env)
    );
  }

  resetAll(): void {
    this.environments.set(DEFAULT_ENVIRONMENTS.map(e => ({ ...e })));
  }
}
