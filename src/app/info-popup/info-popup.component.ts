import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-info-popup',
  templateUrl: './info-popup.component.html',
  styleUrl: './info-popup.component.scss',
})
export class InfoPopupComponent {
  @Output() closePopup: EventEmitter<any> = new EventEmitter();

  baseText: string = 'pixelcampus.space';
  ipText: string = 'pixelcampus.space';
  ipColor: string = '#3e3e3e';

  basePortText: string = '19132';
  portText: string = '19132';
  portColor: string = '#3e3e3e';

  constructor() {}

  ngOnInit() {}

  copyIp() {
    // Copy the IP to the clipboard
    navigator.clipboard.writeText('pixelcampus.space');

    this.setText();
  }

  copyPort() {
    // Copy the port to the clipboard
    navigator.clipboard.writeText('19132');

    this.setPortText();
  }

  onHover() {
    // Change the cursor to a pointer
    document.body.style.cursor = 'copy';
  }

  onLeave() {
    // Change the cursor to a default
    document.body.style.cursor = 'default';
  }

  setText() {
    this.ipText = this.baseText + ' (copied)';
    this.ipColor = 'green';

    setTimeout(() => {
      this.resetText();
    }, 1000);
  }

  resetText() {
    this.ipColor = '#3e3e3e';
    this.ipText = this.baseText;
  }

  setPortText() {
    this.portText = this.basePortText + ' (copied)';
    this.portColor = 'green';

    setTimeout(() => {
      this.resetPortText();
    }, 1000);
  }

  resetPortText() {
    this.portColor = '#3e3e3e';
    this.portText = this.basePortText;
  }
}
