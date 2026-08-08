import {
  ApplicationConfig,
  CSP_NONCE,
  Injectable,
  PendingTasks,
  REQUEST,
  inject,
  mergeApplicationConfig,
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Observable, firstValueFrom, from } from 'rxjs';

import { API_CONFIG, defaultApiConfig, type ApiConfig } from './core/api/api-config';
import { preferredLanguages } from './core/i18n/accept-language';
import { LANGUAGES, NAVIGATOR_LANGUAGES, TranslationLoader, type Language } from './core/i18n/i18n';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/** Header the proxy in front of this process puts its per-request nonce in. */
const CSP_NONCE_HEADER = 'x-csp-nonce';

/**
 * Where this process reaches the APIs.
 *
 * The browser calls them at /api on its own origin, which nginx proxies. This
 * process has no origin to be relative to. It needs addresses of its own, and
 * it can skip the proxy and call the API directly.
 *
 * These are read at start-up, not compiled in. Unlike the settings in .env,
 * they describe the machine the renderer runs on, not the site it renders.
 */
const serverApiConfig: Pick<ApiConfig, 'statsBaseUrl' | 'legacyBaseUrl'> = {
  statsBaseUrl: process.env['PC_SSR_API_URL'] ?? 'http://127.0.0.1:8080',
  legacyBaseUrl: process.env['PC_SSR_LEGACY_API_URL'] ?? 'https://api.pixelcampus.space',
};

/**
 * Reads the translations off disk.
 *
 * The browser fetches them over HTTP. The renderer cannot. The URL is
 * relative, so the renderer would send the request back through the proxy for
 * a file that already sits beside it.
 */
@Injectable()
export class FileTranslationLoader implements TranslocoLoader {
  private static readonly directory = join(import.meta.dirname, '../browser/assets/i18n');

  /*
   * Rendering stops once the application has nothing left to do. Only work
   * Angular knows about counts. HttpClient registers itself. A bare promise
   * does not, so renders came out as an empty shell. The translations arrived
   * after the page was already serialized.
   */
  private readonly pending = inject(PendingTasks);
  private readonly overHttp = inject(TranslationLoader);

  getTranslation(lang: string): Observable<Translation> {
    // The caller is the app's own language list, but a path is being built, so
    // check rather than assume.
    if (!(LANGUAGES as readonly string[]).includes(lang)) {
      throw new Error(`No translations for "${lang}"`);
    }

    const file = join(FileTranslationLoader.directory, `${lang as Language}.json`);
    const done = this.pending.add();

    return from(
      readFile(file, 'utf8')
        .then((json) => JSON.parse(json) as Translation)
        // The development server renders from memory, with no built browser/
        // directory beside it. There the dev server serves the file itself, and
        // the relative URL resolves against the request.
        .catch(() => firstValueFrom(this.overHttp.getTranslation(lang)))
        .finally(done),
    );
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      // Only the addresses this process dials. The prefixes that reach the
      // markup keep the values the browser build computed. Otherwise a visitor
      // gets an address that only the renderer can reach.
      provide: API_CONFIG,
      useFactory: (): ApiConfig => ({ ...defaultApiConfig(), ...serverApiConfig }),
    },
    { provide: TRANSLOCO_LOADER, useClass: FileTranslationLoader },
    {
      // The browser reads navigator.languages; here the same preference arrives
      // as a header. Without this every page would be rendered in German and
      // then swapped to English in front of half the visitors.
      provide: NAVIGATOR_LANGUAGES,
      useFactory: () => preferredLanguages(inject(REQUEST)?.headers.get('accept-language') ?? null),
    },
    {
      /*
       * Rendering writes inline scripts -- the hydration state and the event
       * dispatcher -- and Angular writes component styles as inline <style>
       * elements. Both have to be admitted by name rather than by allowing every
       * inline block, which is what a nonce is for.
       *
       * nginx mints one per request and passes it here; see
       * deploy/nginx-site.conf. Nothing sets it in development, where there is
       * no policy to satisfy either.
       */
      provide: CSP_NONCE,
      useFactory: () => inject(REQUEST)?.headers.get(CSP_NONCE_HEADER) ?? null,
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
