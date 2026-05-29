import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
} from '@angular/core';

import {
  Observable,
  of,
} from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AdoStatusJson } from '../models/ado.model';

@Injectable({ providedIn: 'root' })
export class AdoService {
  private readonly http     = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  /**
   * Reads the pre-generated env-state.json produced by the GitHub Actions
   * workflow. URL is resolved relative to the app's base href so it works
   * under any sub-path (e.g. /naflink-environment-tracker/).
   */
  syncFromJson(): Observable<AdoStatusJson> {
    const url = `${this.document.baseURI}env-state.json`;
    return this.http
      .get<AdoStatusJson>(url)
      .pipe(
        catchError(() => of({ generatedAt: null, latestBuild: null, userState: {} })),
      );
  }
}
