import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';

import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly envService = inject(EnvironmentService);

  onSync(): void {
    // ADO REST API blocks browser requests with CORS, so direct calls never
    // work from a browser regardless of environment. Always read the static
    // env-state.json (written by GitHub Actions in prod; placeholder in dev).
    this.envService.syncFromStatusJson();
  }
}
