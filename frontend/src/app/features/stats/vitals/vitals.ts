import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** Both bars hold ten icons, each worth two points, as in the HUD. */
const ICONS = 10;
const POINTS_PER_ICON = 2;

/** How full one icon is. */
type IconState = 'full' | 'half' | 'empty';

/**
 * Health, hunger and experience drawn with the game's own HUD sprites rather
 * than as numbers.
 */
@Component({
  selector: 'app-vitals',
  templateUrl: './vitals.html',
  styleUrl: './vitals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Vitals {
  /** Health in half-hearts, 0 to 20. */
  readonly health = input<number | null>(null);
  /** Hunger in half-drumsticks, 0 to 20. */
  readonly hunger = input<number | null>(null);
  /**
   * Progress towards the next level, 0 to 1.
   *
   * ServerTap reports only this fraction, never the level, so the bar is drawn
   * without a number above it. Inventing one from the fraction would be a
   * guess presented as fact.
   */
  readonly experience = input<number | null>(null);

  private readonly transloco = inject(TranslocoService);

  protected readonly label = computed(() => this.transloco.translate('stats.health'));
  protected readonly hungerAriaLabel = computed(() => this.transloco.translate('stats.hunger'));
  protected readonly experienceAriaLabel = computed(
    () => `${this.transloco.translate('stats.experience')} ${this.progressPercent()}%`,
  );

  protected readonly hearts = computed(() => icons(this.health()));
  protected readonly food = computed(() => icons(this.hunger()));

  protected readonly hasHealth = computed(() => this.health() !== null);
  protected readonly hasHunger = computed(() => this.hunger() !== null);
  protected readonly hasExperience = computed(() => this.experience() !== null);

  /** Bar fill from 0 to 100. */
  protected readonly progressPercent = computed(() => {
    const progress = this.experience();
    return progress === null ? 0 : Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  });

  protected readonly healthLabel = computed(() => `${this.health() ?? 0} / ${ICONS * POINTS_PER_ICON}`);
  protected readonly hungerLabel = computed(() => `${this.hunger() ?? 0} / ${ICONS * POINTS_PER_ICON}`);
}

/**
 * Splits a 0..20 value into ten icons.
 *
 * @param value Points, where each icon is worth two.
 * @returns Ten states, left to right.
 */
function icons(value: number | null): readonly IconState[] {
  const points = Math.max(0, Math.min(value ?? 0, ICONS * POINTS_PER_ICON));

  return Array.from({ length: ICONS }, (_, index) => {
    const filled = points - index * POINTS_PER_ICON;
    if (filled >= POINTS_PER_ICON) return 'full';
    return filled > 0 ? 'half' : 'empty';
  });
}
