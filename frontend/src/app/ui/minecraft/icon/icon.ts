import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ClickSound } from '../../../core/platform/click-sound';

/**
 * The server icon with the join arrow that appears on hover.
 *
 * The old version stored the overlay element and wrote `style.display` and
 * `style.filter` on it from four separate handlers, using an `[id]` binding as a
 * side-effecting registration hook. Visibility is now a piece of state and the
 * appearance is decided by the stylesheet.
 */
@Component({
  selector: 'app-minecraft-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftIcon {
  /** Icon URL. Defaults to the live server icon. */
  readonly iconUrl = input.required<string>();

  /** Set by the parent so hovering anywhere on the banner reveals the arrow. */
  readonly highlighted = input(false);

  /** Emitted when the join arrow is activated. */
  readonly activated = output<void>();

  private readonly clickSound = inject(ClickSound);
  private readonly hovered = signal(false);

  protected readonly overlayVisible = computed(() => this.hovered() || this.highlighted());

  protected onEnter(): void {
    this.hovered.set(true);
  }

  protected onLeave(): void {
    this.hovered.set(false);
  }

  protected onActivate(event: Event): void {
    // The banner behind the icon has its own click handler; joining must not
    // also trigger it.
    event.stopPropagation();
    this.clickSound.play();
    this.activated.emit();
  }
}
