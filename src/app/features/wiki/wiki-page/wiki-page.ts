import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Frame around a wiki page: title bar, content area and the navigator shadow. */
@Component({
  selector: 'app-wiki-page',
  templateUrl: './wiki-page.html',
  styleUrl: './wiki-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiPage {
  readonly title = input('Wiki');
  /** True while the side navigator is expanded. */
  readonly navExpanded = input(false);
  readonly isMobile = input(false);

  /** Shadow width follows the navigator, so the two never overlap. */
  protected readonly shadowClass = computed(() => {
    if (this.isMobile()) return 'shadow-nav-mobile';
    return this.navExpanded() ? 'shadow-nav-expanded' : 'shadow-nav-closed';
  });

  protected readonly contentClass = computed(() =>
    this.isMobile() ? 'content-mobile' : 'content-desktop',
  );
}
