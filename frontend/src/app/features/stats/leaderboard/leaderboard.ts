import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { LeaderboardMetric } from '../../../core/api/models';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { METRICS, METRIC_LABELS, formatValue } from '../format';

/** Rows requested per page. */
const PAGE_SIZE = 25;

/** The player leaderboard, sortable by metric. */
@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
  imports: [MinecraftButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leaderboard {
  private readonly api = inject(StatsApi);
  private readonly router = inject(Router);

  protected readonly metrics = METRICS;
  protected readonly metricLabels = METRIC_LABELS;
  protected readonly formatValue = formatValue;

  protected readonly metric = signal<LeaderboardMetric>('playtime');

  /** Reloads whenever the selected metric changes. */
  private readonly board = rxResource({
    params: () => this.metric(),
    stream: ({ params }) => this.api.leaderboard(params, PAGE_SIZE),
  });

  protected readonly entries = computed(() => this.board.value()?.entries ?? []);
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
