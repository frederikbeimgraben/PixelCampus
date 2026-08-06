import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { ENV } from '../../../core/config/env.generated';
import { MinecraftPopup } from '../../../ui/minecraft/popup/popup';

/** How long the "copied" confirmation stays on screen. */
const CONFIRMATION_MS = 1000;

/** A value the user can copy, together with its confirmation state. */
class CopyField {
  readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly value: string) {}

  get label(): string {
    return this.copied() ? `${this.value} (copied)` : this.value;
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value);
    } catch {
      // Clipboard access can be refused; the address stays visible for manual copying.
      return;
    }

    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), CONFIRMATION_MS);
  }
}

/** Connection details, with click-to-copy for the address and the Bedrock port. */
@Component({
  selector: 'app-info-popup',
  templateUrl: './info-popup.html',
  styleUrl: './info-popup.scss',
  imports: [MinecraftPopup],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPopup {
  protected readonly host = new CopyField(ENV.serverHost);
  protected readonly port = new CopyField(ENV.bedrockPort);
}
