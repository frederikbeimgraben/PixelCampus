import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { MinecraftTooltipWrapper } from '../tooltip-wrapper/tooltip-wrapper';

/** Milliseconds of latency represented by each additional bar. */
const MS_PER_BAR = 20;

/** The signal-strength bars from the Minecraft server list. */
@Component({
  selector: 'app-latency',
  templateUrl: './latency.html',
  styleUrl: './latency.scss',
  imports: [MinecraftTooltipWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Latency {
  private readonly transloco = inject(TranslocoService);

  /** Round-trip time in milliseconds. Zero means the server did not answer. */
  readonly latency = input(0);

  /** True when the server did not answer, so the unreachable icon is shown. */
  protected readonly offline = computed(() => this.latency() === 0);

  /**
   * Which of the five bar images to show. The index falls as latency rises, so
   * the lowest latency gives 5, the full-signal `ping_5.png`.
   */
  protected readonly barIndex = computed(() => {
    const bars = Math.floor(this.latency() / MS_PER_BAR);
    return 6 - Math.min(Math.max(bars, 1), 5);
  });

  protected readonly label = computed(() =>
    this.offline()
      ? this.transloco.translate('common.offline')
      : `${Math.round(this.latency())} ms`,
  );

  protected readonly unreachableAlt = computed(() =>
    this.transloco.translate('stats.serverUnreachable'),
  );

  protected readonly latencyAlt = computed(() =>
    this.transloco.translate('stats.latency', { value: this.label() }),
  );

  protected readonly tooltipLines = computed(() => [this.label()]);
}
