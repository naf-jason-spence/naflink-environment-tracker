import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  Signal,
} from '@angular/core';

import { Environment } from '../../models/environment.model';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-env-card',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './env-card.component.html',
  styleUrl: './env-card.component.scss',
})
export class EnvCardComponent {
  readonly env = input.required<Environment>();

  private readonly envService = inject(EnvironmentService);

  readonly isMarkingFree: Signal<boolean> = computed(() => this.envService.isMarkingFree(this.env().id));

  markFree(): void {
    this.envService.markAsFree(this.env().id);
  }
}
