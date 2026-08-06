import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ClickSound } from '../../../core/platform/click-sound';
import { MinecraftBanner, NO_PLAYER_COUNT, plainDescription } from '../../../ui/minecraft/banner/banner';
import { ServerBanner } from '../../../ui/minecraft/banner/server-banner';

/** Two activations of the same entry within this window count as a double click. */
const DOUBLE_CLICK_MS = 500;

/** One entry of the server list. */
interface NavigatorEntry {
  readonly id: string;
  readonly title: string;
  readonly description: readonly string[];
  readonly icon: string;
  /** External URL, opened in a new tab. */
  readonly url?: string;
  /** Route inside this application. */
  readonly route?: string;
}

const ENTRIES: readonly NavigatorEntry[] = [
  {
    id: 'stats',
    title: 'Player Statistics',
    description: ['Leaderboard, skins and gear.', '-> /stats'],
    icon: '/assets/items/diamond_sword.png',
    route: '/stats',
  },
  {
    id: 'bluemap',
    title: 'LiveMap',
    description: ['3D BlueMap', '-> map.pixelcampus.space'],
    icon: '/assets/Map.webp',
    url: 'https://map.pixelcampus.space/',
  },
  {
    id: 'discord',
    title: 'Discord',
    description: ['Der Discord Server der Fachschaft.', '-> discord.gg'],
    icon: '/assets/discord.png',
    url: 'https://discord.gg/HQGBwFA3vD',
  },
  {
    id: 'wiki',
    title: 'Wiki',
    description: ['Unsere Wiki.', '-> wiki.pixelcampus.space'],
    icon: '/assets/items/written_book.png',
    url: 'https://wiki.pixelcampus.space/',
  },
];

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
  imports: [MinecraftBanner, ServerBanner],
  host: {
    '(click)': 'clearSelection()',
    '(keydown.escape)': 'clearSelection()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navigator {
  /** Asks the landing page to show the connection details. */
  readonly showPopup = output<void>();

  protected readonly entries = ENTRIES;
  protected readonly noPlayerCount = NO_PLAYER_COUNT;
  protected readonly selected = signal<string | null>(null);

  private readonly router = inject(Router);
  private readonly clickSound = inject(ClickSound);
  private readonly lastActivation = new Map<string, number>();

  protected descriptionOf(entry: NavigatorEntry): ReturnType<typeof plainDescription> {
    return plainDescription(entry.description);
  }

  /**
   * Handles a click on an entry: the first selects it, a second within
   * {@link DOUBLE_CLICK_MS} opens it, matching the Minecraft server list.
   */
  protected select(id: string): void {
    this.clickSound.play();

    const previous = this.lastActivation.get(id);
    const now = Date.now();

    if (this.selected() === id && previous !== undefined && now - previous < DOUBLE_CLICK_MS) {
      this.open(id);
      return;
    }

    this.selected.set(id);
    this.lastActivation.set(id, now);
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
