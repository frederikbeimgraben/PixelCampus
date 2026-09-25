import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, InjectionToken, PLATFORM_ID, inject } from '@angular/core';

import { ENV } from '../config/env.generated';

/**
 * Where the API is.
 *
 * There are two kinds of address. They differ once the server renders pages.
 *
 * - The *base* URL is what the fetching process dials. In the browser that is
 *   this origin. In the renderer it is the API directly, because that process
 *   has no origin of its own.
 * - The *public* prefix goes into the markup, in image sources. The browser
 *   always resolves it, wherever the markup came from. It must match on both
 *   sides. Otherwise the renderer sends a visitor an address only it can
 *   reach, and the policy blocks the request.
 */
export interface ApiConfig {
  /** Base URL for calls to the pixelcampus-api service. */
  readonly statsBaseUrl: string;
  /** Prefix for stats URLs written into the markup. Empty means this origin. */
  readonly statsPublicBase: string;
}

const trimmed = (url: string): string => url.replace(/\/+$/, '');

/**
 * The configuration as built from .env, resolving empty settings against the
 * page's own origin. Must be called in an injection context.
 *
 * Exported so app.config.server.ts can keep the public prefixes and replace
 * only the base URLs.
 */
export function defaultApiConfig(): ApiConfig {
  /*
   * Production leaves the setting empty, meaning this origin: nginx proxies
   * the API under /api/v1 on the site's own host.
   *
   * There is no origin while rendering, and the server DOM does not implement
   * baseURI at all. app.config.server.ts supplies the base URLs there; an empty
   * one left here would fail a fetch rather than crash the injector.
   */
  const origin = isPlatformBrowser(inject(PLATFORM_ID))
    ? new URL(inject(DOCUMENT).baseURI).origin
    : '';

  return {
    statsBaseUrl: trimmed(ENV.statsApiUrl) || origin,
    statsPublicBase: trimmed(ENV.statsApiUrl),
  };
}

/**
 * Injected instead of hard-coded URLs, so tests and local development can point
 * the app at a different backend without touching component code.
 */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: defaultApiConfig,
});
