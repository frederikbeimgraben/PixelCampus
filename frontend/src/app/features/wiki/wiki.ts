import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { WikiApi } from '../../core/api/wiki-api';
import { Viewport } from '../../core/platform/viewport';
import { SideNavigator } from './side-navigator/side-navigator';
import { WikiContent } from './wiki-content/wiki-content';
import { WikiPage } from './wiki-page/wiki-page';

/** Turns a page title into the slug used in the URL fragment. */
export function slugOf(title: string): string {
  return title.toLowerCase().replaceAll(' ', '-');
}

/**
 * The wiki page.
 *
 * The old component did its loading in `ngAfterViewInit` with chained `fetch`
 * calls, kept the page list in a mutable field, drove the open page from
 * `window.location.hash` directly, and called `detectChanges()` by hand in three
 * places to make any of it appear. Loading is now a service call exposed as a
 * signal, and the open page is derived from the router fragment.
 */
@Component({
  selector: 'app-wiki',
  templateUrl: './wiki.html',
  styleUrl: './wiki.scss',
  imports: [SideNavigator, WikiPage, WikiContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wiki {
  private readonly api = inject(WikiApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewport = inject(Viewport);

  protected readonly pages = toSignal(this.api.loadPages(), { initialValue: [] });
  private readonly fragment = toSignal(this.route.fragment);

  /**
   * Index of the open page. Recomputed when the fragment or the page list
   * changes, and writable so the navigator can set it directly.
   */
  protected readonly index = linkedSignal<number>(() => {
    const slug = this.fragment();
    if (!slug) return 0;

    const found = this.pages().findIndex((page) => slugOf(page.title) === slug);
    return found === -1 ? 0 : found;
  });

  protected readonly navExpanded = linkedSignal(() => false);
  protected readonly isMobile = computed(() => this.viewport.isMobile());

  protected readonly entries = computed(() =>
    this.pages().map((page) => ({ title: page.title, icon: page.icon })),
  );

  protected readonly title = computed(() => this.pages()[this.index()]?.title ?? 'Wiki');
  protected readonly content = computed(() => this.pages()[this.index()]?.content ?? []);
  protected readonly loading = computed(() => this.pages().length === 0);

  /** Opens a page and records it in the URL, so the view can be linked to. */
  protected onIndexChange(index: number): void {
    this.index.set(index);

    const page = this.pages()[index];
    if (page === undefined) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: slugOf(page.title),
      replaceUrl: true,
    });
  }
}
