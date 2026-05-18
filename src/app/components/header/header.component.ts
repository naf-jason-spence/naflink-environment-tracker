import { Component, inject } from '@angular/core';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private envService = inject(EnvironmentService);

  onReset(): void {
    if (confirm('Reset all environments to default? This cannot be undone.')) {
      this.envService.resetAll();
    }
  }
}
