import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { EnvironmentService } from '../../services/environment.service';
import { GithubService } from '../../services/github.service';

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
  private readonly githubService = inject(GithubService);

  protected readonly showDispatchInfo = signal(false);
  protected readonly dispatchInfo = signal(this.githubService.getDispatchDebugInfo());
  protected readonly tokenSourceText = computed(() => {
    switch (this.dispatchInfo().tokenSource) {
      case 'runtime-config':
        return 'runtime config';
      case 'local-storage':
        return 'local storage';
      case 'window-global':
        return 'window global';
      default:
        return 'missing';
    }
  });

  toggleDispatchInfo(): void {
    const next = !this.showDispatchInfo();
    this.showDispatchInfo.set(next);
    if (next) {
      this.dispatchInfo.set(this.githubService.getDispatchDebugInfo());
    }
  }

  onSync(): void {
    // ADO REST API blocks browser requests with CORS, so direct calls never
    // work from a browser regardless of environment. Always read the static
    // env-state.json (written by GitHub Actions in prod; placeholder in dev).
    this.envService.syncFromStatusJson();
  }
}
