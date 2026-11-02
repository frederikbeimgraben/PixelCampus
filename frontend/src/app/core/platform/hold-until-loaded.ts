import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

import { AssetLoader } from './asset-loader';

/**
 * Keeps the loading screen up until this image has loaded or failed.
 *
 * For images the page is not complete without, such as the player heads of the
 * leaderboard. Do not use it with loading="lazy": a lazy image below the fold
 * never loads, and the screen would wait for the loader's timeout.
 */
@Directive({
  selector: 'img[appHoldUntilLoaded]',
  host: {
    '(load)': 'release()',
    '(error)': 'release()',
  },
})
export class HoldUntilLoaded {
  protected readonly release = inject(AssetLoader).hold();

  constructor() {
    const image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

    // An image the browser had in its cache can be complete before the
    // listeners above exist, and then fires no load event.
    afterNextRender(() => {
      if (image.complete) this.release();
    });

    inject(DestroyRef).onDestroy(() => this.release());
  }
}
