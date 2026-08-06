import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ENV } from '../../../core/config/env.generated';
import { ClickSound } from '../../../core/platform/click-sound';
import { MinecraftBanner, NO_PLAYER_COUNT, plainDescription } from '../../../ui/minecraft/banner/banner';
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
 * Selection state lives here as a single signal. The old version had each banner
 * register itself with the parent through an `[id]` binding that ran a
 * side-effecting callback during rendering, then reached into the child to call
 * `activate()`/`deactivate()`, which wrote inline styles onto its DOM.
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

  private readonly router = inject(Router);
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
   * Opens an entry on a single click.
   *
   * The list used to copy the game: one click selected, a second within half a
   * second opened. That made the first click look like it had done nothing, and
   * it had no keyboard equivalent.
   */
  protected select(id: string): void {
    this.clickSound.play();
    this.selected.set(id);
    this.open(id);
  }

  /** Clears the selection when the click misses every entry. */
  protected clearSelection(): void {
    this.selected.set(null);
  }

  /** Opens an entry immediately, used by the join arrow. */
  protected open(id: string): void {
    if (id === 'server') {
      this.showPopup.emit();
      return;
    }

    const entry = ENTRIES.find((candidate) => candidate.id === id);
    if (entry === undefined) return;

    if (entry.route !== undefined) {
      void this.router.navigateByUrl(entry.route);
      return;
    }

    if (entry.url !== undefined) {
      // noopener stops the opened page from steering this tab through window.opener.
      window.open(entry.url, '_blank', 'noopener,noreferrer');
    }
  }
}
