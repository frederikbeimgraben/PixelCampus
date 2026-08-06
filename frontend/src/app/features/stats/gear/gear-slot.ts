import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { GearItem } from '../../../core/api/models';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftTooltipWrapper } from '../../../ui/minecraft/tooltip-wrapper/tooltip-wrapper';

/** One equipment slot, empty or holding an item. */
@Component({
  selector: 'app-gear-slot',
  templateUrl: './gear-slot.html',
  styleUrl: './gear-slot.scss',
  imports: [MinecraftTooltipWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GearSlot {
  /** Name of the slot, shown when it is empty. */
  readonly label = input.required<string>();
  readonly item = input<GearItem | null>(null);

  private readonly api = inject(StatsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly textureUrl = computed(() => {
    const item = this.item();
    return item === null ? '' : this.api.itemTextureUrl(item.id);
  });

  /** Tooltip lines: the item name, then its enchantments. */
  protected readonly tooltipLines = computed(() => {
    const item = this.item();
    if (item === null) return [this.label(), this.transloco.translate('slot.empty')];

    const lines = [item.name, ...item.enchantments];
    if (item.amount > 1) lines.push(`x${item.amount}`);
    return lines;
  });

  /** Durability bar width as a percentage, or null when the item does not wear. */
  protected readonly durabilityPercent = computed(() => {
    const durability = this.item()?.durability;
    return durability === null || durability === undefined
      ? null
      : Math.round(durability * 100);
  });

  /** Bar colour goes from green to red as the item wears out, as in the game. */
  protected readonly durabilityColor = computed(() => {
    const percent = this.durabilityPercent();
    if (percent === null) return '';

    const hue = Math.round((percent / 100) * 120);
    return `hsl(${hue}, 90%, 45%)`;
  });

  /** Hides a texture the front end does not have, rather than showing a broken image. */
  protected onTextureError(event: Event): void {
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }
}
