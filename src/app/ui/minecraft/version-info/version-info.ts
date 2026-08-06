import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MinecraftTooltipWrapper } from '../tooltip-wrapper/tooltip-wrapper';

/** The protocol badge, showing the server version on hover. */
@Component({
  selector: 'app-version-info',
  templateUrl: './version-info.html',
  styleUrl: './version-info.scss',
  imports: [MinecraftTooltipWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionInfo {
  readonly version = input<string | undefined>(undefined);

  protected readonly known = computed(() => {
    const version = this.version();
    return version !== undefined && version !== '';
  });

  protected readonly tooltipLines = computed(() => [this.version() ?? '']);
}
