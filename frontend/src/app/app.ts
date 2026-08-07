import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from './core/i18n/i18n';
import { AssetLoader } from './core/platform/asset-loader';
import { ClickSound } from './core/platform/click-sound';
import { LoadingScreen } from './ui/minecraft/loading/loading-screen';

/** Application shell. Routed pages render into the outlet. */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, LoadingScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(LanguageService).init();

    // The loading screen is showing until these arrive.
    inject(AssetLoader).start();
    inject(ClickSound).preload();
  }
}
