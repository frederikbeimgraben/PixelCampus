import { Injectable, inject } from '@angular/core';
import { type WikiPage, type WikiToc } from '@pixelcampus/contract';
import { Observable, from } from 'rxjs';

import { API_CLIENT } from './client';

/** The wiki: a BookStack book that the API reads and sanitizes. */
@Injectable({ providedIn: 'root' })
export class WikiApi {
  private readonly client = inject(API_CLIENT);

  toc(): Observable<WikiToc> {
    return from(this.client.wikiToc());
  }

  page(slug: string): Observable<WikiPage> {
    return from(this.client.wikiPage({ slug }));
  }
}
