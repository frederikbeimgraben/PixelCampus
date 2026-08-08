import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideI18n } from './core/i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No zone.js: change detection is driven by signals alone.
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Route parameters arrive as component inputs, so pages do not have to
      // subscribe to ActivatedRoute by hand.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch()),
    provideI18n(),
    // Reuses the server-rendered DOM rather than throwing it away and drawing
    // it again. withEventReplay records clicks made before the bundle finishes
    // loading and replays them, so an early press is not silently lost.
    provideClientHydration(withEventReplay()),
  ],
};
