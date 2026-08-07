import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { LiveService } from '../../../core/api/live';
import { OFFLINE_STATUS } from '../../../core/api/models';
import { ServerStatusApi } from '../../../core/api/server-status';
import { MinecraftBanner } from './banner';

/**
 * A {@link MinecraftBanner} bound to the live status of the Minecraft server.
 *
 * Separating this from the banner keeps the request out of the presentational
 * component, so a link banner no longer pays for a network call it never uses.
 */
@Component({
  selector: 'app-server-banner',
  imports: [MinecraftBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-minecraft-banner
      [title]="title()"
      [iconUrl]="iconUrl"
      [description]="status().description"
      [latency]="status().latencyMs"
      [playerCount]="status().playerCount"
      [maxPlayerCount]="status().maxPlayerCount"
      [players]="status().players"
      [version]="status().version"
      [active]="active()"
      [openLabel]="openLabel()"
      (selected)="selected.emit()"
      (activated)="activated.emit()"
    ></app-minecraft-banner>
  `,
})
export class ServerBanner {
  readonly title = input('PixelCampus');
  readonly active = input(false);
  readonly openLabel = input<string | undefined>(undefined);
  readonly selected = output<void>();
  readonly activated = output<void>();

  private readonly api = inject(ServerStatusApi);
  private readonly live = inject(LiveService);

  protected readonly iconUrl = this.api.iconUrl;

  /** The list ping, fetched once. It is the only source of the coloured MOTD. */
  private readonly pinged = toSignal(this.api.fetch(), { initialValue: OFFLINE_STATUS });

  /**
   * Player counts follow the live socket once it has said anything, so the
   * banner keeps up with people joining and leaving without the page reloading.
   * The description stays as pinged: the socket reports the MOTD as plain text
   * and re-rendering it would drop its colours.
   */
  protected readonly status = computed(() => {
    const pinged = this.pinged();
    const live = this.live.server();

    if (live === null) return pinged;

    return {
      ...pinged,
      online: live.online,
      // Nothing measures a round trip over an open socket, and a stale figure
      // beside a fresh count would read as the server having got slower.
      latencyMs: live.online ? pinged.latencyMs : 0,
      playerCount: live.playerCount,
      maxPlayerCount: live.maxPlayerCount,
      players: live.players,
      version: live.version === 'unknown' ? pinged.version : live.version,
    };
  });
}
