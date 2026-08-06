import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { ENV } from '../../core/config/env.generated';
import { MinecraftButton } from '../../ui/minecraft/button/button';
import { InfoPopup } from './info-popup/info-popup';
import { Navigator } from './navigator/navigator';

/**
 * The landing page: the server list, and the connection details behind it.
 *
 * The height juggling that used to live here -- a constructor preloading images,
 * an `ngOnInit` and a resize handler both writing `element.style.height` after
 * looking the element up by id -- is gone. Height comes from a CSS variable that
 * ViewportService keeps current, and preloading is handled centrally.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  imports: [MinecraftButton, InfoPopup, Navigator],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly popupVisible = signal(false);
  protected readonly contactUrl = ENV.contactUrl;
  protected readonly privacyUrl = ENV.privacyUrl;

  protected showPopup(): void {
    this.popupVisible.set(true);
  }

  protected closePopup(): void {
    this.popupVisible.set(false);
  }
}
