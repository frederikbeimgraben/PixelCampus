import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, InjectionToken, PLATFORM_ID, inject } from '@angular/core';

import { ENV } from '../config/env.generated';

/**
 * Where the APIs are.
 *
 * Two kinds of address, which are not the same thing once pages are rendered on
 * the server:
 *
 * - the *base* URLs are what the process doing the fetching dials. In the
 *   browser that is this origin; in the renderer it is the API directly, since
 *   that process has no origin of its own.
 * - the *public* prefixes go into the markup -- image sources -- and are always
 *   resolved by the browser, wherever the markup was produced. They must be
 *   identical on both sides, or the renderer would send visitors an address
 *   only it can reach and the policy would block the request.
 */
export interface ApiConfig {
  /** Base URL for calls to the legacy API: server status and icon. */
  readonly legacyBaseUrl: string;
  /** Base URL for calls to the pixelcampus-api service. */
  readonly statsBaseUrl: string;
  /** Prefix for legacy URLs written into the markup. Empty means this origin. */
  readonly legacyPublicBase: string;
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
   * Production leaves the settings empty, meaning this origin: nginx proxies
   * both APIs under /api on the site's own host.
   *
   * There is no origin while rendering, and the server DOM does not implement
   * baseURI at all. app.config.server.ts supplies the base URLs there; an empty
   * one left here would fail a fetch rather than crash the injector.
   */
  const origin = isPlatformBrowser(inject(PLATFORM_ID))
    ? new URL(inject(DOCUMENT).baseURI).origin
    : '';

  return {
    legacyBaseUrl: trimmed(ENV.legacyApiUrl) || origin,
    statsBaseUrl: trimmed(ENV.statsApiUrl) || origin,
    legacyPublicBase: trimmed(ENV.legacyApiUrl),
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
