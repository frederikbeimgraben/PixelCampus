import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ENV } from '../../../core/config/env.generated';
import { ClickSound } from '../../../core/platform/click-sound';
import {
  MinecraftBanner,
  NO_PLAYER_COUNT,
  plainDescription,
} from '../../../ui/minecraft/banner/banner';
import { ServerBanner } from '../../../ui/minecraft/banner/server-banner';

/** One entry of the server list. Text is looked up per language. */
interface NavigatorEntry {
  readonly id: string;
  /** Translation key prefix, expanded to `.title` and `.description`. */
  readonly key: string;
  readonly icon: string;
  /** External URL, opened in a new tab. */
  readonly url?: string;
  /** Route inside this application. */
  readonly route?: string;
  /** Kept out of the list until the target exists. */
  readonly hidden?: boolean;
}

const ENTRIES: readonly NavigatorEntry[] = [
  { id: 'stats', key: 'navigator.stats', icon: '/assets/items/diamond_sword.png', route: '/stats' },
  { id: 'bluemap', key: 'navigator.map', icon: '/assets/Map.webp', url: ENV.mapUrl },
  { id: 'discord', key: 'navigator.discord', icon: '/assets/discord.png', url: ENV.discordUrl },
  {
    // The in-app wiki is gone; this will point at the external BookStack once
    // it exists. Hidden until then.
    id: 'wiki',
    key: 'navigator.wiki',
    icon: '/assets/items/written_book.png',
    url: ENV.wikiUrl,
    hidden: true,
  },
];

/** Host part of a URL, for the "-> example.com" line under each entry. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The server list on the landing page.
 *
 * Selection state lives here as a single signal.
 */
@Component({
  selector: 'app-navigator',
  templateUrl: './navigator.html',
  styleUrl: './navigator.scss',
  imports: [TranslocoDirective, MinecraftBanner, ServerBanner],
  host: {
    '(click)': 'clearSelection()',
    '(keydown.escape)': 'clearSelection()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navigator {
  /** Asks the landing page to show the connection details. */
  readonly showPopup = output<void>();

  protected readonly entries = ENTRIES.filter((entry) => entry.hidden !== true);
  protected readonly noPlayerCount = NO_PLAYER_COUNT;
  protected readonly selected = signal<string | null>(null);

  private readonly clickSound = inject(ClickSound);

  /**
   * @param entry The list entry.
   * @param text The translated description line.
   * @returns Two lines: the description and where the entry leads.
   */
  protected descriptionOf(
    entry: NavigatorEntry,
    text: string,
  ): ReturnType<typeof plainDescription> {
    const target = entry.route ?? (entry.url === undefined ? '' : hostOf(entry.url));
    return plainDescription([text, `-> ${target}`]);
  }

  /**
   * Marks an entry as the selected one, with the game's click.
   *
   * Entries that lead somewhere are anchors and open themselves, which is what
   * makes them work with the keyboard before the page has hydrated. Only the
   * server entry, which opens the connection details in place, is opened from
   * here.
   */
  protected select(id: string): void {
    this.clickSound.play();
    this.selected.set(id);

    if (id === 'server') {
      this.showPopup.emit();
    }
  }

  /** Clears the selection when the click misses every entry. */
  protected clearSelection(): void {
    this.selected.set(null);
  }

  /** The server entry activated from the keyboard; it has no address to follow. */
  protected open(id: string): void {
    if (id === 'server') {
      this.showPopup.emit();
    }
  }
}
