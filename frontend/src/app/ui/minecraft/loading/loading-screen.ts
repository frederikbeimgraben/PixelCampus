import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { AssetLoader } from '../../../core/platform/asset-loader';

/**
 * How long everything must stay loaded before the screen goes away.
 *
 * Pages hand the wait on from one hold to the next: the player page holds
 * while its profile loads, and the 3D figure holds for the skin once the
 * profile is there. Between the two the loader can be ready for a frame, and
 * without this pause the screen went away and came back at once.
 */
const SETTLE_MS = 150;

/**
 * The game's loading screen, shown until the interface can be drawn properly.
 *
 * The server renders it, so it is on screen in the first frame. It would
 * otherwise appear only after the bundle runs, which is the moment it covers.
 * It comes back when a page holds it again later, for example for a skin.
 */
@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.html',
  styleUrl: './loading-screen.scss',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingScreen {
  private readonly assets = inject(AssetLoader);

  protected readonly done = signal(false);

  /*
   * Whole percent. The game's bar advances in steps, and a fractional width on
   * a pixel-art bar renders as a blurred edge.
   */
  protected readonly percent = computed(() => Math.round(this.assets.progress() * 100));

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;

    effect(() => {
      const ready = this.assets.ready();
      clearTimeout(timer);

      if (!ready) {
        this.done.set(false);
        return;
      }

      timer = setTimeout(() => this.done.set(true), SETTLE_MS);
    });
  }
}
