import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { WikiApi } from '../../../core/api/wiki-api';
import { holdWhile } from '../../../core/platform/asset-loader';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { formatDate } from '../../stats/format';
import { wikiLinkAction } from '../wiki-links';

/**
 * One wiki page.
 *
 * The route parameter arrives as an input because the router is configured with
 * `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-wiki-page',
  templateUrl: './wiki-page.html',
  styleUrl: './wiki-page.scss',
  imports: [TranslocoDirective, RouterLink, MinecraftButton],
  // One listener for every link of the page body. A link is focusable on its
  // own, and the keyboard's Enter fires a click on it as well.
  host: { '(click)': 'onArticleClick($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiPage {
  /** Slug from the `/wiki/:page` route. */
  readonly page = input.required<string>();

  private readonly api = inject(WikiApi);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly resource = rxResource({
    params: () => this.page(),
    stream: ({ params }) => this.api.page(params),
  });

  constructor() {
    holdWhile(() => this.resource.isLoading());
  }

  // value() throws while the resource is in its error state.
  protected readonly data = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  protected readonly loading = computed(() => this.resource.isLoading());
  protected readonly failed = computed(() => this.resource.error() !== undefined);

  /*
   * The API sanitizes the page with an allowlist before it sends it: no script,
   * no event handler, no javascript: link, images from its own proxy only.
   * Angular's own sanitizer would strip the ids that bookmarks point at and the
   * rel and target of external links, so the HTML is marked as trusted here.
   */
  protected readonly html = computed(() => {
    const page = this.data();
    return page === undefined ? '' : this.sanitizer.bypassSecurityTrustHtml(page.html);
  });

  protected readonly updated = computed(() => formatDate(this.data()?.updatedAt ?? null));

  /** Keeps links to other wiki pages and bookmarks inside the app. */
  protected onArticleClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('.wiki-content a');
    const action = wikiLinkAction(anchor?.getAttribute('href') ?? null);

    if (action.kind === 'route') {
      event.preventDefault();
      void this.router.navigateByUrl(action.url);
    } else if (action.kind === 'anchor') {
      event.preventDefault();
      this.document.getElementById(action.id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  protected retry(): void {
    this.resource.reload();
  }

  protected goToContents(): void {
    void this.router.navigateByUrl('/wiki');
  }
}
