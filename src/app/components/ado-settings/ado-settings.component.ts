import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';

import { AdoReleaseDefinitionMapping } from '../../models/ado.model';
import { AdoService } from '../../services/ado.service';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-ado-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ado-settings.component.html',
  styleUrl: './ado-settings.component.scss',
})
export class AdoSettingsComponent {
  private readonly envService = inject(EnvironmentService);
  private readonly adoService = inject(AdoService);

  readonly closed = output<void>();

  readonly environments = this.envService.environments;

  // ── Connection form state ─────────────────────────────────────────────────
  readonly org     = signal('');
  readonly project = signal('');
  readonly pat     = signal('');

  // ── Pipeline discovery state ──────────────────────────────────────────────
  readonly pipelines        = signal<{ id: number; name: string }[]>([]);
  readonly pipelinesLoading = signal(false);
  readonly pipelinesError   = signal<string | null>(null);

  readonly canLoadPipelines = computed(() =>
    !!this.org().trim() && !!this.project().trim() && !!this.pat().trim(),
  );

  // ── Mapping form state ────────────────────────────────────────────────────
  /**
   * Single build pipeline definition ID applied to ALL environments.
   * Stored as a string so the <select> [value] binding works without coercion.
   */
  readonly sharedPipelineId = signal('');

  readonly canSave = computed(() =>
    !!this.org().trim() && !!this.project().trim() && !!this.sharedPipelineId(),
  );

  constructor() {
    const config = this.envService.getAdoConfig();
    if (config) {
      this.org.set(config.organization);
      this.project.set(config.project);
      this.pat.set(config.pat);
    }

    // All envs share one pipeline — read the first stored mapping to pre-fill.
    const stored = this.envService.adoMappings();
    if (stored.length) {
      this.sharedPipelineId.set(String(stored[0].releaseDefinitionId));
    }
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  loadPipelines(): void {
    this.pipelinesLoading.set(true);
    this.pipelinesError.set(null);

    this.adoService
      .getBuildPipelines({
        organization: this.org().trim(),
        project:      this.project().trim(),
        pat:          this.pat().trim(),
      })
      .subscribe({
        next: (pipelines) => {
          if (!pipelines.length) {
            this.pipelinesError.set('No build pipelines found. Check org, project, and PAT scope (Build read).');
          } else {
            // Auto-resolve: keep the saved ID if it's still in the list,
            // otherwise fall back to the first pipeline returned.
            const saved = this.sharedPipelineId();
            const match = pipelines.find(p => String(p.id) === saved);
            if (!match) {
              this.sharedPipelineId.set(String(pipelines[0].id));
            }
          }
          this.pipelines.set(pipelines);
          this.pipelinesLoading.set(false);
        },
        error: () => {
          this.pipelinesError.set('Could not reach ADO. Verify org, project, and PAT.');
          this.pipelinesLoading.set(false);
        },
      });
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────

  getSelectedPipelineName(): string {
    return this.pipelines().find(p => String(p.id) === this.sharedPipelineId())?.name ?? '';
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onSave(): void {
    const org  = this.org().trim();
    const proj = this.project().trim();
    const pat  = this.pat().trim();
    const defId = Number(this.sharedPipelineId());

    if (!org || !proj || !defId) return;

    this.envService.saveAdoSettings(org, proj);
    if (pat) this.envService.saveAdoPat(pat);

    // Apply the single shared pipeline to every environment.
    const mappings: AdoReleaseDefinitionMapping[] = this.environments().map(env => ({
      envId:                env.id,
      releaseDefinitionId:  defId,
      releaseEnvironmentId: 0,  // 0 = build/YAML pipeline (no classic release stage)
    }));

    this.envService.setAdoMappings(mappings);
    this.closed.emit();
  }

  onClose(): void {
    this.closed.emit();
  }
}

