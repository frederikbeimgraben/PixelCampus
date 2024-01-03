import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Minecraft GUI Module
import { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';

// Wiki UI Module
import { WikiUiModule } from './wiki/wiki-ui.module';

@NgModule({
  declarations: [

  ],
  exports: [
    MinecraftGuiModule,
    WikiUiModule
  ],
  imports: [
    CommonModule,
    MinecraftGuiModule,
    WikiUiModule
  ]
})
export class CommonGuiModule { }

export { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';