import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss'
})
export class IconComponent {
  @Input() customIcon: string | undefined;

  @Output() ClickAction: EventEmitter<any> = new EventEmitter();

  overlay: HTMLElement | null = null;

  public simulateHoverIcon() {
    // Simulate a mouse hover event
    if (this.overlay != null)
      this.onHoverIcon(this.overlay);
  }

  public simulateLeaveIcon() {
    // Simulate a mouse leave event
    if (this.overlay != null)
      this.onLeaveIcon(this.overlay);
  }

  public registerOverlay(element: HTMLElement) {
    this.overlay = element;
    return 'overlay';
  }

  public onHoverIcon(overlay: HTMLElement) {
    if (this.overlay != undefined)
      this.overlay.style.display = 'flex';
  }

  public onLeaveIcon(overlay: HTMLElement) {
    if (this.overlay != undefined)
      this.overlay.style.display = 'none';
  }

  public onHoverOverlay() {
    if (this.overlay != undefined)
      this.overlay.style.filter = 'sepia(70%) hue-rotate(190deg)';
  }

  public onLeaveOverlay() {
    if (this.overlay != undefined)
      this.overlay.style.filter = 'brightness(100%)';
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

  onClickOverlay(event: MouseEvent) {
    this.playClickSound();
    // Stop the event from bubbling up to the parent
    event.stopPropagation();
    this.ClickAction.emit();
  }
}
