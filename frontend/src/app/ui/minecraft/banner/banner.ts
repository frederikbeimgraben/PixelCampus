import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormattedLine } from '../../../core/api/models';
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
export function plainDescription(lines: readonly string[]): FormattedLine[] {
  return lines.map((text) => [{ text, color: 'gray', fontFamily: 'Minecraft Italic' }]);
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
  imports: [MinecraftIcon, PlayerCount, VersionInfo, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftBanner {
  readonly title = input.required<string>();
  readonly description = input<readonly FormattedLine[]>([]);
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

  /** Accessible label for the row, already translated. */
  readonly openLabel = input<string | undefined>(undefined);

  /** Route this entry leads to, if it leads anywhere inside the site. */
  readonly routerLink = input<string | undefined>(undefined);

  /** External address this entry leads to, opened in a new tab. */
  readonly href = input<string | undefined>(undefined);

  /** The row was clicked: the list should select it. */
  readonly selected = output<void>();

  /** The entry should open now, from the join arrow or the Enter key. */
  readonly activated = output<void>();

  protected readonly hovered = signal(false);

  protected readonly label = computed(() => this.openLabel() ?? `Open ${this.title()}`);

  protected onEnter(): void {
    this.hovered.set(true);
  }

  protected onLeave(): void {
    this.hovered.set(false);
  }

  /**
   * Marks the row as the selected entry, and stops the click reaching the list
   * background, which would clear the selection again.
   *
   * An anchor opens itself from here; only the button form needs
   * {@link activated} to be told.
   */
  protected onSelect(event: Event): void {
    event.stopPropagation();
    this.selected.emit();
  }

  /** Enter and Space on the button form, which has no address to follow. */
  protected onKeyActivate(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activated.emit();
  }
}
