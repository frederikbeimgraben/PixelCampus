import { Component } from '@angular/core';

const resources = [
  // Popup
  "/assets/popup/card-bl.png",
  "/assets/popup/card-br.png",
  "/assets/popup/card-tl.png",
  "/assets/popup/card-tr.png",
  "/assets/popup/card.png",
  "/assets/popup/card-bottom.png",
  "/assets/popup/card-top.png",
  "/assets/popup/card-left.png",
  "/assets/popup/card-right.png",
  "/assets/popup/card-content.png",
  // Tooltip
  "/assets/tooltip/border-horizontal.png",
  "/assets/tooltip/border-vertical.png",
  "/assets/tooltip/inner-border-horizontal.png",
  "/assets/tooltip/inner.png",
  "/assets/tooltip/latency_background.png",
  // Button
  "/assets/button/border-top.png",
  "/assets/button/border-bottom.png",
  "/assets/button/border-left.png",
  "/assets/button/border-right.png",
  "/assets/button/background.png",
];

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  title = 'PixelCampus';

  showPopup: boolean = false;

  constructor() {
    // Preload resources
    for (const resource of resources) {
      const img = new Image();
      img.src = resource;
    }
  }

  triggerPopup() {
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  openLink(link: string) {
    window.open(link, '_blank');
  }
}
