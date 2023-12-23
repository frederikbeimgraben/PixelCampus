import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Minecraft GUI Module
import { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';

// Components
import { WikiPageComponent } from './wiki-page/wiki-page.component';
import { WikiNavigationPanelComponent } from './wiki-navigation-panel/wiki-navigation-panel.component';

// mat-sidenav, mat-toolbar, mat-icon, mat-list
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule, MatListItem } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    WikiPageComponent,
    WikiNavigationPanelComponent
  ],
  exports: [
    MinecraftGuiModule,
    WikiPageComponent,
    WikiNavigationPanelComponent
  ],
  imports: [
    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule
  ]
})
export class CommonGuiModule { }

export { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';