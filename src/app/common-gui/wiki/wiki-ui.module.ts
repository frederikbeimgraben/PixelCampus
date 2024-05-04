import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WikiItem } from './wiki-item';

import { SideNavigatorComponent } from './side-navigator/side-navigator.component';
import { WikiContentItemsComponent } from './wiki-content-items/wiki-content-items.component';
import { WikiPageComponent } from './wiki-page/wiki-page.component';

import { MinecraftGuiModule } from '../common-gui.module';
@NgModule({
  declarations: [
    SideNavigatorComponent,
    WikiPageComponent,
    WikiContentItemsComponent
  ],
  exports: [
    SideNavigatorComponent,
    WikiPageComponent,
    WikiContentItemsComponent
  ],
  imports: [
    CommonModule,
    MinecraftGuiModule
  ]
})
export class WikiUiModule { }

export { WikiItem } from './wiki-item';