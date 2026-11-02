import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { WikiApi } from '../../../core/api/wiki-api';
import { holdWhile } from '../../../core/platform/asset-loader';
import { MinecraftButton } from '../../../ui/minecraft/button/button';

/** The contents of the wiki: loose pages first, then each chapter with its pages. */
@Component({
  selector: 'app-wiki-index',
  templateUrl: './wiki-index.html',
  styleUrl: './wiki-index.scss',
  imports: [TranslocoDirective, RouterLink, MinecraftButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiIndex {
  private readonly api = inject(WikiApi);
  private readonly router = inject(Router);

  private readonly toc = rxResource({ stream: () => this.api.toc() });

  constructor() {
    holdWhile(() => this.toc.isLoading());
  }

  // value() throws while the resource is in its error state.
  protected readonly data = computed(() => (this.toc.hasValue() ? this.toc.value() : undefined));
  protected readonly loading = computed(() => this.toc.isLoading());
  protected readonly failed = computed(() => this.toc.error() !== undefined);
  protected readonly empty = computed(() => {
    const toc = this.data();
    return toc !== undefined && toc.pages.length === 0 && toc.chapters.length === 0;
  });

  protected retry(): void {
    this.toc.reload();
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/');
  }
}
