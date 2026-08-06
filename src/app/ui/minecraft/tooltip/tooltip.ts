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
  readonly width = input(0);
  readonly height = input(0);
  readonly xPosition = input(0);
  readonly yPosition = input(0);
}
