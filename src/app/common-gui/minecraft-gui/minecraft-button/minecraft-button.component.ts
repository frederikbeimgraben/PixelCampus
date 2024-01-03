import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-minecraft-button',
  templateUrl: './minecraft-button.component.html',
  styleUrl: './minecraft-button.component.scss'
})
export class MinecraftButtonComponent {
  @Output() ClickAction: EventEmitter<any> = new EventEmitter();

  button: HTMLElement | null = null;
  
  constructor() {}

  ngOnInit() {}

  registerButton(element: HTMLElement) {
    this.button = element;
    return 'button';
  }

  onHover() {
    if (this.button != undefined) {
      this.button.style.filter = 'sepia(70%) hue-rotate(190deg)';
      this.button.style.border = '3px solid white';
    }
  }

  onLeave() {
    if (this.button != undefined) {
      this.button.style.filter = 'brightness(100%)';
      this.button.style.border = '3px solid black';
    }
  }

  playClickSound() {
    // If on mobile, don't play the sound
    if (navigator.userAgent.match(/Android/i) ||
        navigator.userAgent.match(/webOS/i) ||
        navigator.userAgent.match(/iPhone/i) ||
        navigator.userAgent.match(/iPad/i) ||
        navigator.userAgent.match(/iPod/i) ||
        navigator.userAgent.match(/BlackBerry/i) ||
        navigator.userAgent.match(/Windows Phone/i))
      return;
    
    const audio = new Audio();
    audio.src = '/assets/sounds/click.mp3';
    audio.load();

    // play from 500ms to ...
    audio.currentTime = 0.5;

    audio.play();
  }

  onClick() {
    this.playClickSound();
    this.ClickAction.emit();
  }
}
