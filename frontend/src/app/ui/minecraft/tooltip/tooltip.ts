import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Minecraft tooltip frame. Positioning is decided by the wrapper. */
@Component({
  selector: 'app-minecraft-tooltip',
  templateUrl: './tooltip.html',
  styleUrl: './tooltip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftTooltip {
  /** Whether the tooltip is currently shown. */
  readonly display = input(false);

  /**
   * Position of the right edge, and of the top edge, in pixels from the corner
   * of the viewport.
   *
   * The frame is placed by its right edge, not its left, so that its width
   * never has to be known. See the transform in the stylesheet.
   */
  readonly xPosition = input(0);
  readonly yPosition = input(0);
}
