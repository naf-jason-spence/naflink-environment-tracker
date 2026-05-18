import {
  Component, input, inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Environment } from '../../models/environment.model';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-env-card',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="env-card" [class]="'env-card group-' + env().group" [class.is-occupied]="env().status === 'occupied'">

      <!-- Top row -->
      <div class="card-top">
        <div class="card-top-left">
          <span class="env-badge" [class]="'env-badge--' + env().group">{{ env().name }}</span>
          <span class="status-pill" [class.pill-occupied]="env().status === 'occupied'" [class.pill-free]="env().status === 'free'">
            <span class="status-dot" [class.dot-occupied]="env().status === 'occupied'" [class.dot-free]="env().status === 'free'"></span>
            {{ env().status === 'occupied' ? 'Occupied' : 'Free' }}
          </span>
        </div>
        <button class="clear-btn" (click)="onClear()" [class.clear-visible]="env().status === 'occupied'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
          </svg>
          Clear
        </button>
      </div>

      <p class="deploy-status">{{ env().branchOrRepo ? 'Deployed' : 'Not deployed' }}</p>

      <!-- Fields -->
      <div class="fields">

        <div class="field-group">
          <label class="field-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            Branch / Repo
          </label>
          <input
            class="field-input mono"
            type="text"
            [value]="env().branchOrRepo"
            (blur)="onCommit('branchOrRepo', $any($event.target).value)"
            (keydown.enter)="$any($event.target).blur()"
            (keydown.escape)="onReset('branchOrRepo', $any($event.target))"
            placeholder="feature/login-fix or org/repo"
          />
        </div>

        <div class="field-group">
          <label class="field-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            Deployed By
          </label>
          <input
            class="field-input"
            type="text"
            [value]="env().lockedBy"
            (blur)="onCommit('lockedBy', $any($event.target).value)"
            (keydown.enter)="$any($event.target).blur()"
            (keydown.escape)="onReset('lockedBy', $any($event.target))"
            placeholder="Name or initials"
          />
        </div>

        <div class="field-group">
          <label class="field-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Notes / Link
          </label>
          <input
            class="field-input"
            type="text"
            [value]="env().notes"
            (blur)="onCommit('notes', $any($event.target).value)"
            (keydown.enter)="$any($event.target).blur()"
            (keydown.escape)="onReset('notes', $any($event.target))"
            placeholder="Jira ticket or note"
          />
        </div>

      </div>

      @if (env().lastUpdated) {
        <div class="card-footer">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Updated {{ env().lastUpdated | date:'MMM d, h:mm a' }}
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Base card ── */
    .env-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      box-shadow: var(--card-shadow);
      padding: 1rem 1.1rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      transition: box-shadow 0.15s ease;
      border-left-width: 3px;
      border-left-style: solid;
    }
    .env-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.1); }

    /* ── Group accent colors ── */
    .group-qa  { border-left-color: #3b82f6; background: #f8fbff; }
    .group-uat { border-left-color: #f59e0b; background: #f8fbff; }

    /* Occupied overrides the left border to green */
    .is-occupied { border-left-color: #22c55e; }

    /* ── Top row ── */
    .card-top { display: flex; align-items: center; justify-content: space-between; }
    .card-top-left { display: flex; align-items: center; gap: 0.55rem; }

    /* ── Env badge — group colored ── */
    .env-badge {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.22rem 0.65rem;
      border-radius: 6px;
    }
    .env-badge--qa {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .env-badge--uat {
      background: #fef3c7;
      color: #b45309;
    }

    /* ── Status pill ── */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.74rem;
      font-weight: 500;
      padding: 0.15rem 0.55rem;
      border-radius: 99px;
      border: 1px solid;
    }
    .pill-free    { color: #64748b; background: #f1f5f9; border-color: #e2e8f0; }
    .pill-occupied { color: #15803d; background: #dcfce7; border-color: #bbf7d0; }

    .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .dot-free     { background: #94a3b8; }
    .dot-occupied { background: #22c55e; }

    /* ── Clear button ── */
    .clear-btn {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.74rem;
      font-weight: 500;
      cursor: pointer;
      padding: 0.25rem 0.4rem;
      border-radius: 5px;
      font-family: inherit;
      transition: all 0.15s;
      opacity: 0;
      pointer-events: none;
    }
    .clear-btn.clear-visible { opacity: 1; pointer-events: auto; }
    .clear-btn:hover { color: var(--danger); background: var(--danger-bg); }

    .deploy-status { font-size: 0.77rem; color: var(--text-muted); margin-top: -0.25rem; }

    /* ── Fields ── */
    .fields { display: flex; flex-direction: column; gap: 0.5rem; }
    .field-group { display: flex; flex-direction: column; gap: 0.2rem; }
    .field-label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .field-input {
      width: 100%;
      padding: 0.42rem 0.65rem;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      font-size: 0.82rem;
      color: var(--text-primary);
      font-family: var(--font-sans);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field-input.mono { font-family: var(--font-mono); font-size: 0.78rem; }
    .field-input::placeholder { color: var(--text-muted); font-family: var(--font-sans); }
    .field-input:focus {
      border-color: var(--input-focus);
      box-shadow: 0 0 0 3px rgba(59,111,212,0.12);
    }

    /* ── Footer ── */
    .card-footer {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.67rem;
      color: var(--text-muted);
      padding-top: 0.5rem;
      border-top: 1px solid var(--card-border);
      margin-top: 0.1rem;
    }
  `]
})
export class EnvCardComponent {
  readonly env = input.required<Environment>();
  private envService = inject(EnvironmentService);

  onCommit(field: 'branchOrRepo' | 'lockedBy' | 'notes', raw: string): void {
    const value = raw.trim();
    if (value === this.env()[field]) return;
    const changes: Partial<Environment> = { [field]: value };
    const updated = { ...this.env(), ...changes };
    changes['status'] = (updated.branchOrRepo || updated.lockedBy) ? 'occupied' : 'free';
    this.envService.update(this.env().id, changes);
  }

  onReset(field: 'branchOrRepo' | 'lockedBy' | 'notes', input: HTMLInputElement): void {
    input.value = this.env()[field];
    input.blur();
  }

  onClear(): void {
    this.envService.clear(this.env().id);
  }
}
