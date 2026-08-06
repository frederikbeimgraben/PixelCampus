import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { GearItem } from '../../../core/api/models';
import { StatsApi } from '../../../core/api/stats-api';
import { MinecraftTooltipWrapper } from '../../../ui/minecraft/tooltip-wrapper/tooltip-wrapper';

/** Which armour slot this is, used to pick the vanilla empty silhouette. */
export type SlotKind = 'helmet' | 'chestplate' | 'leggings' | 'boots' | 'offHand' | 'mainHand';

/** The greyed-out shapes vanilla draws in an empty equipment slot. */
const EMPTY_SILHOUETTE: Partial<Record<SlotKind, string>> = {
  helmet: '/assets/items/empty_armor_slot_helmet.png',
  chestplate: '/assets/items/empty_armor_slot_chestplate.png',
  leggings: '/assets/items/empty_armor_slot_leggings.png',
  boots: '/assets/items/empty_armor_slot_boots.png',
  offHand: '/assets/items/empty_armor_slot_shield.png',
};

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
  readonly kind = input<SlotKind>('mainHand');

  private readonly api = inject(StatsApi);
  private readonly transloco = inject(TranslocoService);

  /** Set when the texture 404s, so the slot can show a readable stand-in. */
  private readonly textureMissing = signal(false);

  protected readonly textureUrl = computed(() => {
    const item = this.item();
    return item === null ? '' : this.api.itemTextureUrl(item.id);
  });

  protected readonly emptyUrl = computed(() => EMPTY_SILHOUETTE[this.kind()] ?? null);

  protected readonly showFallback = computed(() => this.item() !== null && this.textureMissing());

  /**
   * Shields, tridents and banners are drawn from entity textures, so they have
   * no item icon. Their first letters stand in rather than an empty box.
   */
  protected readonly fallbackLabel = computed(() => {
    const name = this.item()?.name ?? '';
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
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
    return durability === null || durability === undefined ? null : Math.round(durability * 100);
  });

  /** Bar colour goes from green to red as the item wears out, as in the game. */
  protected readonly durabilityColor = computed(() => {
    const percent = this.durabilityPercent();
    if (percent === null) return '';

    const hue = Math.round((percent / 100) * 120);
    return `hsl(${hue}, 90%, 45%)`;
  });

  protected readonly enchanted = computed(() => (this.item()?.enchantments.length ?? 0) > 0);

  protected onTextureError(): void {
    this.textureMissing.set(true);
  }
}
