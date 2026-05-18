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

  onToggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  onSync(): void {
    // ADO REST API blocks browser requests with CORS, so direct calls never
    // work from a browser regardless of environment. Always read the static
    // ado-status.json (written by GitHub Actions in prod; placeholder in dev).
    this.envService.syncFromStatusJson();
  }
}
