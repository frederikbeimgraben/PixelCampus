import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { MinecraftButton } from '../../ui/minecraft/button/button';
import { InfoPopup } from './info-popup/info-popup';
import { Navigator } from './navigator/navigator';

/** Where the footer links point. */
const CONTACT_URL = 'mailto:support@pixelcampus.space';
const PRIVACY_URL = 'https://wiki.pixelcampus.space/de/impressum-und-datenschutz';

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
  protected readonly contactUrl = CONTACT_URL;
  protected readonly privacyUrl = PRIVACY_URL;

  protected showPopup(): void {
    this.popupVisible.set(true);
  }

  protected closePopup(): void {
    this.popupVisible.set(false);
  }
}
