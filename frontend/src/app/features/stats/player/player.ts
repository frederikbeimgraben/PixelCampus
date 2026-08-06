import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { formatCount, formatBlocks, formatDate, formatDuration } from '../format';
import { GearSlot } from '../gear/gear-slot';

/** One row of the statistics table. */
interface StatRow {
  readonly label: string;
  readonly value: string;
}

/**
 * Detail page for a single player: skin, equipped gear and aggregate statistics.
 *
 * The route parameter arrives as an input because the router is configured with
 * `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-player',
  templateUrl: './player.html',
  styleUrl: './player.scss',
  imports: [MinecraftButton, GearSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Player {
  /** UUID or name from the `/stats/:player` route. */
  readonly player = input.required<string>();

  private readonly api = inject(StatsApi);
  private readonly router = inject(Router);

  private readonly profile = rxResource({
    params: () => this.player(),
    stream: ({ params }) => this.api.player(params),
  });

  // Reading value() on an errored resource throws, and the title bar reads this
  // outside the error branch, so it has to be guarded.
  protected readonly data = computed(() => (this.profile.hasValue() ? this.profile.value() : undefined));
  protected readonly loading = computed(() => this.profile.isLoading());
  protected readonly failed = computed(() => this.profile.error() !== undefined);

  protected readonly gear = computed(() => this.data()?.gear ?? null);

  protected readonly skinUrl = computed(() => {
    const uuid = this.data()?.uuid;
    return uuid === undefined ? '' : this.api.skinUrl(uuid, 'body', 256);
  });

  /** The statistics table, built once per profile. */
  protected readonly rows = computed<readonly StatRow[]>(() => {
    const stats = this.data()?.stats;
    if (stats === undefined) return [];

    return [
      { label: 'Playtime', value: formatDuration(stats.playtimeMs) },
      { label: 'Sessions', value: formatCount(stats.sessions) },
      { label: 'Kills', value: formatCount(stats.kills) },
      { label: 'Deaths', value: formatCount(stats.deaths) },
      { label: 'K/D', value: ratio(stats.kills, stats.deaths) },
      { label: 'Blocks mined', value: formatCount(stats.blocksMined) },
      { label: 'Blocks placed', value: formatCount(stats.blocksPlaced) },
      { label: 'Distance', value: formatBlocks(stats.distanceTravelledBlocks) },
      { label: 'First seen', value: formatDate(stats.firstSeen) },
      { label: 'Last seen', value: formatDate(stats.lastSeen) },
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
