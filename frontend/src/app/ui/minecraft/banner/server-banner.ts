import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { LiveService } from '../../../core/api/live';
import { OFFLINE_STATUS } from '../../../core/api/models';
import { ServerStatusApi } from '../../../core/api/server-status';
import { MinecraftBanner } from './banner';

/**
 * A {@link MinecraftBanner} bound to the live status of the Minecraft server.
 *
 * This is separate from the banner so that the request stays out of the
 * presentational component. A link banner makes no network call.
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

  /** The server information, fetched once. It gives the banner its first frame. */
  private readonly pinged = toSignal(this.api.fetch(), { initialValue: OFFLINE_STATUS });

  /**
   * Player counts follow the live socket once it reports anything. The banner
   * then tracks players who join and leave without a page reload.
   *
   * The description stays as fetched. An operator seldom changes the MOTD
   * while a page is open, and drawing it again on every message costs more
   * than it shows.
   */
  protected readonly status = computed(() => {
    const pinged = this.pinged();
    const live = this.live.server();

    if (live === null) return pinged;

    return {
      ...pinged,
      online: live.online,
      // The socket sends a latency only beside another change, so its figure
      // is old by the time it arrives. A stale figure beside a fresh count
      // would read as the server having got slower. It is used only when the
      // fetch found the server offline, because 0 draws the banner offline.
      latencyMs: live.online ? pinged.latencyMs || (live.latencyMs ?? 0) : 0,
      playerCount: live.playerCount,
      maxPlayerCount: live.maxPlayerCount,
      players: live.players,
      version: live.version === 'unknown' ? pinged.version : live.version,
    };
  });
}
