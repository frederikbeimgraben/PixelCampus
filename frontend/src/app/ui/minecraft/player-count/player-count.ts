import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Latency } from '../latency/latency';
import { MinecraftTooltipWrapper } from '../tooltip-wrapper/tooltip-wrapper';

/** How many player names the hover list shows. */
const SAMPLE_LIMIT = 2;

/** Longest player name shown before it is shortened. */
const NAME_LIMIT = 16;

/**
 * The `online / max` counter with the player sample on hover.
 *
 * As with the latency component, the old version carried tooltip positioning
 * code that the template never wired up, so it never ran.
 */
@Component({
  selector: 'app-player-count',
  templateUrl: './player-count.html',
  styleUrl: './player-count.scss',
  imports: [Latency, MinecraftTooltipWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerCount {
  readonly playerCount = input(0);
  readonly maxPlayerCount = input(100);
  readonly latency = input(0);
  readonly players = input<readonly string[]>([]);

  /** True before the first successful ping, when the counts mean nothing yet. */
  protected readonly unknown = computed(() => this.latency() === 0);

  /** True when the server is being hidden entirely, matching the old template guard. */
  protected readonly hidden = computed(() => this.latency() < 0);

  protected readonly sample = computed(() =>
    this.players()
      .slice(0, SAMPLE_LIMIT)
      .map((name) => (name.length > NAME_LIMIT ? `${name.slice(0, NAME_LIMIT)}...` : name)),
  );
}
