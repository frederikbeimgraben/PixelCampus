import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Content, parseWiki } from '../../features/wiki/parser/parser';
import { API_CONFIG } from './api-config';
import { WikiPageRef, WikiSitemap } from './models';

/** A wiki page with its source already parsed. */
export interface WikiPage {
  readonly title: string;
  readonly content: readonly Content[];
  readonly icon: string;
}

const FALLBACK_ICON = '/assets/items/compass_01.png';

interface SitemapEnvelope {
  data?: WikiSitemap;
}

/** Loads the wiki table of contents and the pages it points at. */
@Injectable({ providedIn: 'root' })
export class WikiApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  private get endpoint(): string {
    return `${this.config.legacyBaseUrl}/api/wiki`;
  }

  /**
   * Loads every wiki page.
   *
   * The pages are requested in parallel. The original code awaited them one after
   * another inside a `for` loop, so the wiki took the sum of all round trips to
   * appear instead of the slowest one.
   */
  loadPages(): Observable<readonly WikiPage[]> {
    return this.http.get<SitemapEnvelope>(this.endpoint).pipe(
      map((envelope) => this.toPageRefs(envelope.data)),
      switchMap((refs) =>
        refs.length === 0
          ? of([])
          : forkJoin(refs.map((ref) => this.loadPage(ref))),
      ),
      map((pages) => pages.filter((page): page is WikiPage => page !== null)),
      catchError(() => of([])),
    );
  }

  private toPageRefs(sitemap: WikiSitemap | undefined): WikiPageRef[] {
    return [
      { title: 'Wiki Home', path: sitemap?.index ?? '' },
      ...(sitemap?.pages ?? []),
    ];
  }

  private loadPage(ref: WikiPageRef): Observable<WikiPage | null> {
    return this.http
      .get(`${this.endpoint}/${ref.path}`, { responseType: 'text' })
      .pipe(
        map(
          (source): WikiPage => ({
            title: ref.title,
            content: parseWiki(source),
            icon: this.resolveIcon(ref.icon),
          }),
        ),
        // One missing page must not blank the whole wiki.
        catchError(() => of(null)),
      );
  }

  private resolveIcon(icon: string | undefined): string {
    if (icon === undefined) return FALLBACK_ICON;
    if (icon.startsWith('http')) return icon;
    return `${this.config.legacyBaseUrl}/static${icon}`;
  }
}
