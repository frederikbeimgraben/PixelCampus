import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { FormattedSpan } from '../../../core/api/models';
import { MinecraftIcon } from '../icon/icon';
import { PlayerCount } from '../player-count/player-count';
import { VersionInfo } from '../version-info/version-info';

/** Latency value that hides the player counter, used by link banners. */
export const NO_PLAYER_COUNT = -1;

/**
 * Builds a description from plain lines.
 *
 * Link banners used to pass a string of HTML into `[innerHTML]`. Angular
 * sanitises that, but it still means markup travels through a data field for no
 * reason. Descriptions are structured data now, and nothing is parsed as HTML.
 */
export function plainDescription(lines: readonly string[]): FormattedSpan[] {
  return lines.map((text) => ({ text, color: 'gray', fontFamily: 'Minecraft Italic' }));
}

/**
 * One row of the Minecraft server list.
 *
 * Purely presentational: everything it renders arrives as an input. Live server
 * data is supplied by {@link ServerBanner}. The old component fetched its own
 * status in the constructor, which made it impossible to render a link banner
 * without also issuing a network request.
 */
@Component({
  selector: 'app-minecraft-banner',
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
  imports: [MinecraftIcon, PlayerCount, VersionInfo],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftBanner {
  readonly title = input.required<string>();
  readonly description = input<readonly FormattedSpan[]>([]);
  readonly iconUrl = input.required<string>();

  /** Round-trip time in ms; {@link NO_PLAYER_COUNT} hides the counter. */
  readonly latency = input(0);
  readonly playerCount = input(0);
  readonly maxPlayerCount = input(0);
  readonly players = input<readonly string[]>([]);

  /** Server version, or undefined to hide the badge. */
  readonly version = input<string | undefined>(undefined);

  /** Whether this banner is the selected entry in the list. */
  readonly active = input(false);

  /** The row was clicked: the list should select it. */
  readonly selected = output<void>();

  /** The entry should open now, from the join arrow or the Enter key. */
  readonly activated = output<void>();

  protected readonly hovered = signal(false);

  protected onEnter(): void {
    this.hovered.set(true);
  }

  protected onLeave(): void {
    this.hovered.set(false);
  }

  /** Selects the row, and stops the click reaching the list background. */
  protected onSelect(event: Event): void {
    event.stopPropagation();
    this.selected.emit();
  }

  /**
   * Keyboard activation opens the entry directly.
   *
   * With a pointer the list follows the game: click selects, a second click
   * opens. That has no keyboard equivalent, so Enter and Space open at once and
   * the join arrow can stay a decoration rather than a second tab stop nested
   * inside this one.
   */
  protected onKeyActivate(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activated.emit();
  }
}
