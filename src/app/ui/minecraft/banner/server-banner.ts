import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

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
      (selected)="selected.emit()"
      (activated)="activated.emit()"
    ></app-minecraft-banner>
  `,
})
export class ServerBanner {
  readonly title = input('PixelCampus');
  readonly active = input(false);
  readonly selected = output<void>();
  readonly activated = output<void>();

  private readonly api = inject(ServerStatusApi);

  protected readonly iconUrl = this.api.iconUrl;
  protected readonly status = toSignal(this.api.fetch(), { initialValue: OFFLINE_STATUS });
}
