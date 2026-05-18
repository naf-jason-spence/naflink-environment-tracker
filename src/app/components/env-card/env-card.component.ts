import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
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
