import { DOCUMENT, InjectionToken, inject } from '@angular/core';

import { ENV } from '../config/env.generated';

/** Origins the app talks to. Keep in sync with the connect-src list in index.html. */
export interface ApiConfig {
  /** Base URL of the legacy PixelCampus API that serves the server status and icon. */
  readonly legacyBaseUrl: string;
  /** Base URL of the pixelcampus-api service that serves player statistics. */
  readonly statsBaseUrl: string;
}

/**
 * Resolves one configured base URL.
 *
 * Empty means this origin. Production proxies both APIs under /api on the site's
 * own host, so every request is same-origin and connect-src stays 'self'. A full
 * URL is still accepted, for deployments that keep an API on its own host.
 *
 * @param configured Value from .env, possibly empty.
 * @param document Document whose base URI supplies the origin.
 * @returns An absolute base URL without a trailing slash.
 */
function baseUrl(configured: string, document: Document): string {
  return configured.replace(/\/+$/, '') || new URL(document.baseURI).origin;
}

/**
 * Injected instead of hard-coded URLs, so tests and local development can point
 * the app at a different backend without touching component code.
 */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);

    return {
      legacyBaseUrl: baseUrl(ENV.legacyApiUrl, document),
      statsBaseUrl: baseUrl(ENV.statsApiUrl, document),
    };
  },
});
