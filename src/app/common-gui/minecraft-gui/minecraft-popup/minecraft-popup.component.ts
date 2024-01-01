import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-minecraft-popup',
  templateUrl: './minecraft-popup.component.html',
  styleUrl: './minecraft-popup.component.scss'
})
export class MinecraftPopupComponent {
  @Input() contentPadding: number = 20;
  
  get contentPaddingString(): string {
    return `${this.contentPadding}px`;
  }

  get widthString(): string {
    return `calc(100% - ${this.contentPaddingString} * 2)`;
  }

  get heightString(): string {
    return `calc(100% - ${this.contentPaddingString} * 2)`;
  }

  constructor() {}

  ngOnInit() { }
}
