import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { ClickSound } from '../../../core/platform/click-sound';

/**
 * The Minecraft push button.
 *
 * Hover styling moved to the stylesheet; it used to be four DOM writes from
 * TypeScript, which also meant keyboard focus produced no visible change.
 */
@Component({
  selector: 'app-minecraft-button',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftButton {
  /** When set, activating the button opens this URL in a new tab. */
  readonly target = input<string | undefined>(undefined);

  /** Accessible label, for buttons whose content is not text. */
  readonly label = input<string | undefined>(undefined);

  readonly activated = output<void>();

  private readonly clickSound = inject(ClickSound);

  protected onActivate(): void {
    this.clickSound.play();
    this.activated.emit();

    const target = this.target();
    if (target === undefined) {
      return;
    }

    // noopener stops the opened page reaching back through window.opener, which
    // is enough to navigate this tab somewhere else.
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}
