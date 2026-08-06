import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MinecraftTooltipWrapper } from '../tooltip-wrapper/tooltip-wrapper';

/** Milliseconds of latency represented by each additional bar. */
const MS_PER_BAR = 20;

/**
 * The signal-strength bars from the Minecraft server list.
 *
 * The old component also carried its own tooltip positioning code. None of it
 * was reachable: the template never called `registerTooltip`, so the element
 * reference stayed null and every handler was a no-op. The tooltip has always
 * come from the wrapper below.
 */
@Component({
  selector: 'app-latency',
  templateUrl: './latency.html',
  styleUrl: './latency.scss',
  imports: [MinecraftTooltipWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Latency {
  /** Round-trip time in milliseconds. Zero means the server did not answer. */
  readonly latency = input(0);

  /** True when the server did not answer, so the unreachable icon is shown. */
  protected readonly offline = computed(() => this.latency() === 0);

  /** Which of the five bar images to show; 1 is best, 5 is worst. */
  protected readonly barIndex = computed(() => {
    const bars = Math.floor(this.latency() / MS_PER_BAR);
    return 6 - Math.min(Math.max(bars, 1), 5);
  });

  protected readonly label = computed(() =>
    this.offline() ? 'offline' : `${Math.round(this.latency())} ms`,
  );

  protected readonly tooltipLines = computed(() => [this.label()]);
}
