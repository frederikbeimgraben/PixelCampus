import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ENV } from '../../core/config/env.generated';
import { LanguageSwitch } from '../../ui/language-switch/language-switch';
import { MinecraftButton } from '../../ui/minecraft/button/button';
import { InfoPopup } from './info-popup/info-popup';
import { Navigator } from './navigator/navigator';

/** The landing page: the server list, and the connection details behind it. */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  imports: [TranslocoDirective, LanguageSwitch, MinecraftButton, InfoPopup, Navigator],
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
