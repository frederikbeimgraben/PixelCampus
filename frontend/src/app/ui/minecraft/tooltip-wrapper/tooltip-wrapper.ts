import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { Viewport } from '../../../core/platform/viewport';
import { MinecraftTooltip } from '../tooltip/tooltip';

/** Space between the pointer and the tooltip frame. */
const POINTER_GAP_PX = 4;

/**
 * Height of one line of tooltip text, and of the frame around the lines, in
 * pixels. Both mirror the stylesheet of the tooltip.
 *
 * The height follows the number of lines, which is known. The width does not
 * follow the number of characters: the face is not monospaced, so the frame
 * places itself by its right edge and its width is never needed.
 */
const LINE_HEIGHT_PX = 24;
const FRAME_HEIGHT_PX = 18;

/**
 * Shows a Minecraft tooltip while the wrapped content is hovered or focused.
 *
 * Nothing measures the frame. An early version read `offsetWidth` in the
 * mousemove handler, which made the browser lay the page out again on every
 * movement. A later one counted the characters, which cut the text off, and a
 * third watched the element with a ResizeObserver, which reported 0 for ever
 * because it held the node that hydration replaced.
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

  /** Height of the frame, from the line count. The stylesheet fixes both parts. */
  private readonly height = computed(
    () => this.content().length * LINE_HEIGHT_PX + FRAME_HEIGHT_PX,
  );

  /**
   * The right edge of the frame, which the stylesheet turns into a left edge.
   *
   * It sits beside the pointer, so the frame always opens towards the middle
   * of the screen and cannot run off the right of it.
   */
  protected readonly x = computed(() => this.pointerX() + POINTER_GAP_PX);

  /**
   * Top edge. The tooltip goes above the pointer, and below it when there is
   * not enough space above.
   *
   * It must not go on top of the pointer. The frame is clear of the pointer
   * now, but a tooltip with many lines is taller than the space above it, and
   * a value held at 0 put the frame around the pointer.
   */
  protected readonly y = computed(() => {
    const height = this.height();

    const above = this.pointerY() - height - POINTER_GAP_PX;
    if (above >= 0) {
      return above;
    }

    const below = this.pointerY() + POINTER_GAP_PX;
    const bottomLimit = Math.max(0, this.viewport.height() - height);
    return Math.min(below, bottomLimit);
  });

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
