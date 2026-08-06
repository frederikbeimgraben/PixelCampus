import { InjectionToken } from '@angular/core';

/** Origins the app talks to. Keep in sync with the connect-src list in index.html. */
export interface ApiConfig {
  /** Base URL of the legacy PixelCampus API that serves the wiki and the server status. */
  readonly legacyBaseUrl: string;
  /** Base URL of the pixelcampus-api service that serves player statistics. */
  readonly statsBaseUrl: string;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  legacyBaseUrl: 'https://api.pixelcampus.space',
  statsBaseUrl: 'https://api.pixelcampus.space',
};

/**
 * Injected instead of hard-coded URLs, so tests and local development can point
 * the app at a different backend without touching component code.
 */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_API_CONFIG,
});
