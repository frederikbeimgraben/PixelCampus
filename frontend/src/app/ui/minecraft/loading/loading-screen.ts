import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AssetLoader } from '../../../core/platform/asset-loader';

/**
 * The game's loading screen, shown until the interface can be drawn properly.
 *
 * The server renders it, so it is on screen in the first frame. It would
 * otherwise appear only after the bundle runs, which is the moment it covers.
 */
@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.html',
  styleUrl: './loading-screen.scss',
  imports: [TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingScreen {
  private readonly assets = inject(AssetLoader);

  protected readonly done = this.assets.ready;

  /*
   * Whole percent. The game's bar advances in steps, and a fractional width on
   * a pixel-art bar renders as a blurred edge.
   */
  protected readonly percent = computed(() => Math.round(this.assets.progress() * 100));
}
