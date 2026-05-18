import { Component, inject } from '@angular/core';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-summary-bar',
  standalone: true,
  template: `
    <div class="summary-bar">
      <div class="summary-inner">
        <div class="summary-text">
          <span class="stat occupied">{{ envService.occupiedCount() }} occupied</span>
          <span class="divider">·</span>
          <span class="stat free">{{ envService.freeCount() }} free</span>
          <span class="divider">·</span>
          <span class="stat total">of {{ envService.total() }} environments</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" [style.width.%]="occupiedPercent()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .summary-bar {
      background: linear-gradient(135deg, #0d1b3e 0%, #1e3a7a 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0.6rem 1.75rem;
    }
    .summary-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .summary-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .stat { font-weight: 500; }
    .occupied { color: #f97316; }
    .free { color: #22c55e; }
    .total { color: rgba(255,255,255,0.35); font-weight: 400; }
    .divider { color: rgba(255,255,255,0.2); }
    .progress-bar-wrap {
      flex: 1;
      height: 4px;
      background: rgba(255,255,255,0.12);
      border-radius: 99px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: #f97316;
      border-radius: 99px;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
  `]
})
export class SummaryBarComponent {
  envService = inject(EnvironmentService);

  occupiedPercent() {
    const total = this.envService.total();
    return total === 0 ? 0 : (this.envService.occupiedCount() / total) * 100;
  }
}
