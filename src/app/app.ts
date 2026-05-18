import {
  Component,
  inject,
} from '@angular/core';

import { EnvCardComponent } from './components/env-card/env-card.component';
import { HeaderComponent } from './components/header/header.component';
import {
  SummaryBarComponent,
} from './components/summary-bar/summary-bar.component';
import { EnvironmentService } from './services/environment.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, SummaryBarComponent, EnvCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly envService = inject(EnvironmentService);
}
