import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { MinecraftGuiModule, CommonGuiModule } from './common-gui/common-gui.module';
import { BrowserModule } from '@angular/platform-browser';
import { LandingComponent } from './landing/landing.component';
import { WikiComponent } from './wiki/wiki.component';

import { HttpClientModule } from '@angular/common/http';

// Navigator
import { NavigatorComponent } from './navigator/navigator.component';
import { InfoPopupComponent } from './info-popup/info-popup.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent,
    NavigatorComponent,
    InfoPopupComponent,
    LandingComponent,
    WikiComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    MinecraftGuiModule,
    CommonGuiModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }
