import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { MinecraftGuiModule } from './minecraft-gui/minecraft-gui.module';
import { BrowserModule } from '@angular/platform-browser';

// Navigator
import { NavigatorComponent } from './navigator/navigator.component';
import { InfoPopupComponent } from './info-popup/info-popup.component';

@NgModule({
  declarations: [
    AppComponent,
    NavigatorComponent,
    InfoPopupComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    MinecraftGuiModule,
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }
