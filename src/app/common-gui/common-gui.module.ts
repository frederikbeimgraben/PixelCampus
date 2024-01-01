import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Minecraft GUI Module
import { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';

// Components
import { WikiPageComponent } from './wiki-page/wiki-page.component';
import { WikiNavigationPanelComponent } from './wiki-navigation-panel/wiki-navigation-panel.component';
import { SideNavigatorComponent } from './side-navigator/side-navigator.component';

@NgModule({
  declarations: [
    WikiPageComponent,
    WikiNavigationPanelComponent,
    SideNavigatorComponent
  ],
  exports: [
    MinecraftGuiModule,
    WikiPageComponent,
    WikiNavigationPanelComponent,
    SideNavigatorComponent
  ],
  imports: [
    CommonModule,
    MinecraftGuiModule
  ]
})
export class CommonGuiModule { }

export { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';