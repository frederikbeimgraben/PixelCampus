import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavigatorComponent } from './navigator/navigator.component';
import { InfoPopupComponent } from './info-popup/info-popup.component';
import { MinecraftTooltipComponent } from './minecraft-tooltip/minecraft-tooltip.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet,
    NavigatorComponent,
    InfoPopupComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'PixelCampus';

  showPopup: boolean = false;

  triggerPopup() {
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }
}
