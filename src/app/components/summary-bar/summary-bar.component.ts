import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Signal,
} from '@angular/core';

import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-summary-bar',
  standalone: true,
  templateUrl: './summary-bar.component.html',
  styleUrl: './summary-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryBarComponent {
  protected readonly envService = inject(EnvironmentService);

  readonly occupiedPercent: Signal<number> = computed(() => {
    const total: number = this.envService.total();
    return total === 0 ? 0 : (this.envService.occupiedCount() / total) * 100;
  });
}
