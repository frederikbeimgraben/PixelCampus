import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinecraftTooltipComponent } from './minecraft-tooltip/minecraft-tooltip.component';
import { MinecraftPopupComponent } from './minecraft-popup/minecraft-popup.component';
import { MinecraftTooltipWrapperComponent } from './minecraft-tooltip-wrapper/minecraft-tooltip-wrapper.component';
import { MinecraftButtonComponent } from './minecraft-button/minecraft-button.component';
import { MinecraftIconComponent } from './minecraft-icon/minecraft-icon.component';
import { MinecraftBannerComponent } from './minecraft-banner/minecraft-banner.component';
import { LatencyComponent } from './latency/latency.component';
import { PlayerCountComponent } from './player-count/player-count.component';

@NgModule({
  declarations: [
    MinecraftTooltipComponent,
    MinecraftPopupComponent,
    MinecraftTooltipWrapperComponent,
    MinecraftButtonComponent,
    MinecraftIconComponent,
    MinecraftBannerComponent,
    LatencyComponent,
    PlayerCountComponent
  ],
  exports: [
    MinecraftTooltipComponent,
    MinecraftPopupComponent,
    MinecraftTooltipWrapperComponent,
    MinecraftButtonComponent,
    MinecraftIconComponent,
    MinecraftBannerComponent,
    LatencyComponent,
    PlayerCountComponent
  ],
  imports: [
    CommonModule,
  ]
})
export class MinecraftGuiModule { }

export { MinecraftTooltipComponent } from './minecraft-tooltip/minecraft-tooltip.component';
export { MinecraftPopupComponent } from './minecraft-popup/minecraft-popup.component';
export { MinecraftTooltipWrapperComponent } from './minecraft-tooltip-wrapper/minecraft-tooltip-wrapper.component';
export { MinecraftButtonComponent } from './minecraft-button/minecraft-button.component';
export { MinecraftIconComponent } from './minecraft-icon/minecraft-icon.component';