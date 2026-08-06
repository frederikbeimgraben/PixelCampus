import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  TranslocoLoader,
  Translation,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { Observable } from 'rxjs';

/** Languages the site is available in. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'de';

/** Key the chosen language is stored under. */
const STORAGE_KEY = 'pc.lang';

/** Where the browser's language preference comes from; replaced in tests. */
export const NAVIGATOR_LANGUAGES = new InjectionToken<readonly string[]>('NAVIGATOR_LANGUAGES', {
  providedIn: 'root',
  factory: () => (typeof navigator === 'undefined' ? [] : navigator.languages),
});

@Injectable({ providedIn: 'root' })
export class TranslationLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<Translation> {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}

/**
 * Picks the starting language: a previous choice, else the browser preference,
 * else German, since the server is a German university's.
 *
 * @param stored Previously chosen language, if any.
 * @param preferred Browser language tags, most preferred first.
 */
export function resolveLanguage(
  stored: string | null,
  preferred: readonly string[],
): Language {
  if (isLanguage(stored)) return stored;

  for (const tag of preferred) {
    // Browsers send region tags such as "de-AT"; only the base matters here.
    const base = tag.split('-')[0]?.toLowerCase();
    if (isLanguage(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}

function isLanguage(value: string | null | undefined): value is Language {
  return value !== null && value !== undefined && (LANGUAGES as readonly string[]).includes(value);
}

/** Reads and writes the chosen language, and applies it. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly preferred = inject(NAVIGATOR_LANGUAGES);

  /** Applies the stored or preferred language. Called once at start-up. */
  init(): void {
    this.use(resolveLanguage(read(), this.preferred));
  }

  current(): Language {
    const active = this.transloco.getActiveLang();
    return isLanguage(active) ? active : DEFAULT_LANGUAGE;
  }

  use(language: Language): void {
    this.transloco.setActiveLang(language);
    write(language);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; fall back to the browser preference.
    return null;
  }
}

function write(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}

export function provideI18n() {
  return provideTransloco({
    config: {
      availableLangs: [...LANGUAGES],
      defaultLang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
      reRenderOnLangChange: true,
      prodMode: true,
      missingHandler: {
        // Show the key rather than an empty element, so a gap is obvious.
        useFallbackTranslation: true,
        allowEmpty: false,
      },
    },
    loader: TranslationLoader,
  });
}
