import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { Viewport } from '../../../core/platform/viewport';
import { MinecraftTooltip } from '../tooltip/tooltip';

/** Rendered width of one character, and the line height, in pixels. */
const CHARACTER_WIDTH_PX = 12.75;
const LINE_HEIGHT_PX = 21.25;

/** Space between the pointer and the tooltip frame. */
const POINTER_GAP_PX = 4;

/**
 * Shows a Minecraft tooltip while the wrapped content is hovered or focused.
 *
 * The tooltip size is computed from the text. The old version instead read
 * `offsetWidth` off the live element inside the mousemove handler, which forced
 * the browser to re-run layout on every pointer movement.
 */
@Component({
  selector: 'app-minecraft-tooltip-wrapper',
  templateUrl: './tooltip-wrapper.html',
  styleUrl: './tooltip-wrapper.scss',
  imports: [MinecraftTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftTooltipWrapper {
  /** Lines of tooltip text. */
  readonly content = input<readonly string[]>([]);
  /** Set false to suppress the tooltip while keeping the wrapped content. */
  readonly showTooltip = input(true);

  private readonly viewport = inject(Viewport);
  private readonly pointerX = signal(0);
  private readonly pointerY = signal(0);
  private readonly active = signal(false);

  protected readonly visible = computed(
    () => this.active() && this.showTooltip() && this.content().length > 0,
  );

  protected readonly height = computed(() => this.content().length * LINE_HEIGHT_PX + 6);

  protected readonly width = computed(() => {
    const lines = this.content();
    if (lines.length === 0) return 0;

    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return longest * CHARACTER_WIDTH_PX * 0.6 + 6;
  });

  /** Left edge, kept inside the viewport. */
  protected readonly x = computed(() => {
    const width = this.width();
    const preferred = this.pointerX() - width + POINTER_GAP_PX;
    const rightLimit = this.viewport.width() - width - POINTER_GAP_PX;
    return Math.max(0, Math.min(preferred, rightLimit));
  });

  /** Top edge, placed above the pointer. */
  protected readonly y = computed(() =>
    Math.max(0, this.pointerY() - this.height() - POINTER_GAP_PX),
  );

  protected show(): void {
    this.active.set(true);
  }

  protected hide(): void {
    this.active.set(false);
  }

  protected track(event: MouseEvent): void {
    this.pointerX.set(event.clientX);
    this.pointerY.set(event.clientY);
  }
}
