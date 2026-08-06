import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No zone.js: change detection is driven by signals alone. This is what let
    // the manual ChangeDetectorRef.detectChanges() calls in the old wiki and
    // navigator components go away.
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Route parameters arrive as component inputs, so pages do not have to
      // subscribe to ActivatedRoute by hand.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch()),
  ],
};
