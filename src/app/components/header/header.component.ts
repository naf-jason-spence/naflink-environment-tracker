import { Component, inject } from '@angular/core';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="header">
      <div class="header-inner">
        <div class="logo-area">
          <div class="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div>
            <h1 class="app-title">QA Deployment Tracker</h1>
            <p class="app-subtitle">Internal dashboard</p>
          </div>
        </div>
        <button class="reset-btn" (click)="onReset()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
          </svg>
          Reset All
        </button>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: linear-gradient(135deg, #0d1b3e 0%, #1e3a7a 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 1.75rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.15);
      color: #fff;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .app-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: -0.01em;
      margin: 0;
    }
    .app-subtitle {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.5);
      margin: 0;
    }
    .reset-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.85rem;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 7px;
      color: rgba(255,255,255,0.6);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }
    .reset-btn:hover {
      border-color: #ef4444;
      color: #ef4444;
      background: rgba(239,68,68,0.1);
    }
  `]
})
export class HeaderComponent {
  private envService = inject(EnvironmentService);

  onReset(): void {
    if (confirm('Reset all environments to default? This cannot be undone.')) {
      this.envService.resetAll();
    }
  }
}
