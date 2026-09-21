import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { LiveService } from '../../../core/api/live';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { formatCount, formatDate, formatDuration } from '../format';
import { PlayerSkin } from '../skin/player-skin';

/** One row of the statistics table. The key is looked up per language. */
interface StatRow {
  readonly key: string;
  readonly value: string;
}

/**
 * Detail page for a single player: skin and aggregate statistics.
 *
 * The route parameter arrives as an input because the router is configured with
 * `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-player',
  templateUrl: './player.html',
  styleUrl: './player.scss',
  imports: [TranslocoDirective, MinecraftButton, PlayerSkin],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Player {
  /** UUID or name from the `/stats/:player` route. */
  readonly player = input.required<string>();

  private readonly api = inject(StatsApi);
  private readonly router = inject(Router);
  private readonly live = inject(LiveService);

  private readonly profile = rxResource({
    params: () => this.player(),
    stream: ({ params }) => this.api.player(params),
  });

  constructor() {
    effect(() => this.live.watch(this.player()));
    inject(DestroyRef).onDestroy(() => this.live.watch(null));
  }

  /**
   * The fetched profile, with the presence the socket reports once it watches
   * this player. That changes while the page is open. The socket does not send
   * the statistics again.
   */
  // value() throws on an errored resource, and the title bar reads this outside
  // the error branch, so it needs the guard.
  protected readonly data = computed(() => {
    const fetched = this.profile.hasValue() ? this.profile.value() : undefined;
    if (fetched === undefined) return undefined;

    // The server resolves a watch. The uuid marks the update as one for the
    // player on screen, not for a player the page is leaving.
    const live = this.live.player();
    return live !== null && live.uuid === fetched.uuid ? { ...fetched, ...live } : fetched;
  });
  protected readonly loading = computed(() => this.profile.isLoading());
  protected readonly failed = computed(() => this.profile.error() !== undefined);

  /** The statistics table, built once per profile. */
  protected readonly rows = computed<readonly StatRow[]>(() => {
    const stats = this.data()?.stats;
    if (stats === undefined) return [];

    return [
      { key: 'playtime', value: formatDuration(stats.playtimeMs) },
      { key: 'sessions', value: formatCount(stats.sessions) },
      { key: 'kills', value: formatCount(stats.kills) },
      { key: 'deaths', value: formatCount(stats.deaths) },
      { key: 'kd', value: ratio(stats.kills, stats.deaths) },
      { key: 'firstSeen', value: formatDate(stats.firstSeen) },
      { key: 'lastSeen', value: formatDate(stats.lastSeen) },
    ];
  });

  protected retry(): void {
    this.profile.reload();
  }

  protected goBack(): void {
    void this.router.navigateByUrl('/stats');
  }
}

/** Kills per death, counting a player with no deaths as having one. */
function ratio(kills: number, deaths: number): string {
  return (kills / Math.max(deaths, 1)).toFixed(2);
}
