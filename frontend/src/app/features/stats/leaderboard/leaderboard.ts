import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { LiveService } from '../../../core/api/live';
import { LeaderboardMetric } from '../../../core/api/models';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { METRICS, formatValue } from '../format';

/** Rows requested per page. */
const PAGE_SIZE = 25;

/** The player leaderboard, sortable by metric. */
@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
  imports: [TranslocoDirective, MinecraftButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leaderboard {
  private readonly api = inject(StatsApi);
  private readonly router = inject(Router);
  private readonly live = inject(LiveService);

  protected readonly metrics = METRICS;
  protected readonly formatValue = formatValue;

  protected readonly metric = signal<LeaderboardMetric>('playtime');

  /** Reloads whenever the selected metric changes. */
  private readonly board = rxResource({
    params: () => this.metric(),
    stream: ({ params }) => this.api.leaderboard(params, PAGE_SIZE),
  });

  /** Who is online, per the live socket, or null before it has said anything. */
  private readonly onlineNames = computed(() => {
    const server = this.live.server();
    return server === null ? null : new Set(server.players.map((name) => name.toLowerCase()));
  });

  /**
   * The page, with presence from the socket where the socket has it. The board
   * is fetched once, so its own flags go stale as players log in and out.
   */
  // value() throws while the resource is in its error state.
  protected readonly entries = computed(() => {
    const rows = this.board.hasValue() ? (this.board.value()?.entries ?? []) : [];
    const online = this.onlineNames();

    if (online === null) return rows;

    return rows.map((row) => ({ ...row, online: online.has(row.name.toLowerCase()) }));
  });
  protected readonly loading = computed(() => this.board.isLoading());
  protected readonly failed = computed(() => this.board.error() !== undefined);

  protected selectMetric(metric: LeaderboardMetric): void {
    this.metric.set(metric);
  }

  protected retry(): void {
    this.board.reload();
  }

  protected openPlayer(name: string): void {
    void this.router.navigate(['/stats', name]);
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/');
  }

  protected skinUrl(uuid: string): string {
    return this.api.skinUrl(uuid, 'head', 64);
  }
}
