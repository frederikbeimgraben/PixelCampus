import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AssetPreloader } from './core/platform/asset-preloader';
import { ClickSound } from './core/platform/click-sound';

/** Application shell. Routed pages render into the outlet. */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Both run from an idle callback, so neither delays the first paint.
    inject(AssetPreloader).start();
    inject(ClickSound).preload();
  }
}
