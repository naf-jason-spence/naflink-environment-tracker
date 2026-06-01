import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Environment } from '../../models/environment.model';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-env-card',
  standalone: true,
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './env-card.component.html',
  styleUrl: './env-card.component.scss',
})
export class EnvCardComponent {
  readonly env = input.required<Environment>();

  private readonly envService = inject(EnvironmentService);

  readonly editBranchOrRepo = signal('');
  readonly editDeployedBy = signal('');

  readonly isMarkingFree: Signal<boolean> = computed(() => this.envService.isMarkingFree(this.env().id));
  readonly isMarkingOccupied: Signal<boolean> = computed(() => this.envService.isMarkingOccupied(this.env().id));
  readonly canSaveOccupied: Signal<boolean> = computed(() => this.editBranchOrRepo().trim().length > 0 && !this.isMarkingOccupied());

  constructor() {
    effect(() => {
      const env = this.env();
      this.editBranchOrRepo.set(env.branchOrRepo ?? '');
      this.editDeployedBy.set(env.lockedBy ?? '');
    });
  }

  markFree(): void {
    this.envService.markAsFree(this.env().id);
  }

  saveOccupied(): void {
    if (!this.canSaveOccupied()) return;
    this.envService.markAsOccupied(this.env().id, this.editBranchOrRepo(), this.editDeployedBy());
  }

  cancelOccupiedEdit(): void {
    const env = this.env();
    this.editBranchOrRepo.set(env.branchOrRepo ?? '');
    this.editDeployedBy.set(env.lockedBy ?? '');
  }
}
