import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { EnvironmentService } from '../../services/environment.service';
import { AdoSettingsComponent } from '../ado-settings/ado-settings.component';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdoSettingsComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly envService = inject(EnvironmentService);
  readonly settingsOpen = signal(false);

  onReset(): void {
    if (confirm('Reset all environments to default? This cannot be undone.')) {
      this.envService.resetAll();
    }
  }

  onToggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  onSync(): void {
    if (this.envService.isProduction) {
      this.envService.syncFromStatusJson();
    } else {
      this.envService.syncFromAdo();
    }
  }
}
