import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import type { GearItem, PlayerGear } from '../../../core/api/models';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { formatCount, formatBlocks, formatDate, formatDuration } from '../format';
import { GearSlot, type SlotKind } from '../gear/gear-slot';
import { PlayerSkin } from '../skin/player-skin';
import { Vitals } from '../vitals/vitals';

/** One row of the statistics table. The key is looked up per language. */
interface StatRow {
  readonly key: string;
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
  imports: [TranslocoDirective, MinecraftButton, GearSlot, PlayerSkin, Vitals],
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

  /** Formatted capture date, shown only when the reading is not live. */
  protected readonly gearCapturedAt = computed(() => {
    const captured = this.data()?.gearCapturedAt;
    return captured === null || captured === undefined ? null : formatDate(captured);
  });

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
      { key: 'blocksMined', value: formatCount(stats.blocksMined) },
      { key: 'blocksPlaced', value: formatCount(stats.blocksPlaced) },
      { key: 'distance', value: formatBlocks(stats.distanceTravelledBlocks) },
      { key: 'firstSeen', value: formatDate(stats.firstSeen) },
      { key: 'lastSeen', value: formatDate(stats.lastSeen) },
    ];
  });

  /**
   * @param gear The player's equipment.
   * @returns The six slots in inventory order, ready to render.
   */
  protected slotsOf(gear: PlayerGear): readonly { kind: SlotKind; item: GearItem | null }[] {
    return [
      { kind: 'helmet', item: gear.helmet },
      { kind: 'chestplate', item: gear.chestplate },
      { kind: 'leggings', item: gear.leggings },
      { kind: 'boots', item: gear.boots },
      { kind: 'mainHand', item: gear.mainHand },
      { kind: 'offHand', item: gear.offHand },
    ];
  }

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
