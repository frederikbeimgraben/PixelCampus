import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The nine-slice Minecraft panel used for cards and dialogs. */
@Component({
  selector: 'app-minecraft-popup',
  templateUrl: './popup.html',
  styleUrl: './popup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinecraftPopup {
  /** Inner padding in pixels. */
  readonly contentPadding = input(20);

  protected readonly padding = computed(() => `${this.contentPadding()}px`);
  protected readonly size = computed(() => `calc(100% - ${this.contentPadding() * 2}px)`);
}
