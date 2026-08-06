import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { Router } from '@angular/router';

/** One entry of the wiki navigator. */
export interface NavEntry {
  readonly title: string;
  readonly icon: string;
}

/**
 * The collapsible page list beside the wiki.
 *
 * The `WikiItem` class it used to take has gone: it carried an `id`, an `index`
 * and an `active` flag that all duplicated the position in the array, and the
 * component mutated `active` on every entry before telling the parent which one
 * had been picked. The selected index is now a single two-way bound value.
 */
@Component({
  selector: 'app-side-navigator',
  templateUrl: './side-navigator.html',
  styleUrl: './side-navigator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavigator {
  readonly pages = input<readonly NavEntry[]>([]);
  readonly isMobile = input(false);

  /** Index of the open page. Two-way bound to the wiki page. */
  readonly index = model(0);

  /** Reports whether the navigator is expanded, so the page can shift its shadow. */
  readonly expandedChange = output<boolean>();

  private readonly router = inject(Router);
  protected readonly expanded = signal(false);

  protected select(index: number): void {
    this.index.set(index);

    if (this.isMobile()) {
      this.setExpanded(false);
    }
  }

  protected onEnter(): void {
    if (!this.isMobile()) this.setExpanded(true);
  }

  protected onLeave(): void {
    if (!this.isMobile()) this.setExpanded(false);
  }

  protected toggle(): void {
    this.setExpanded(!this.expanded());
  }

  protected goHome(): void {
    // Router navigation instead of window.location.href, which used to reload
    // the whole application to reach a route it already had loaded.
    void this.router.navigateByUrl('/');
  }

  protected currentIcon(): string {
    return this.pages()[this.index()]?.icon ?? '';
  }

  private setExpanded(expanded: boolean): void {
    this.expanded.set(expanded);
    this.expandedChange.emit(expanded);
  }
}
