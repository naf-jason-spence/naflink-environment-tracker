import {
  Component,
  inject,
} from '@angular/core';

import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-summary-bar',
  standalone: true,
  templateUrl: './summary-bar.component.html',
  styleUrl: './summary-bar.component.scss',
})
export class SummaryBarComponent {
  protected readonly envService = inject(EnvironmentService);

  occupiedPercent(): number {
    const total = this.envService.total();
    return total === 0 ? 0 : (this.envService.occupiedCount() / total) * 100;
  }
}
