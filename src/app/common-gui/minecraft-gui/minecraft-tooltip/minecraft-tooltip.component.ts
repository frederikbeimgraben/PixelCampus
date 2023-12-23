import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-minecraft-tooltip',
  templateUrl: './minecraft-tooltip.component.html',
  styleUrl: './minecraft-tooltip.component.scss'
})
export class MinecraftTooltipComponent {
  @Input() display: boolean = false;
  @Input() width: number = 0;
  @Input() height: number = 0;
  @Input() xPosition: number = 0;
  @Input() yPosition: number = 0;

  @Output() ClickAction: EventEmitter<any> = new EventEmitter();

  constructor() {}

  ngOnInit() { }

  get x() {
    return `${this.xPosition}px`;
  }

  get y() {
    return `${this.yPosition}px`;
  }

  get w() {
    return `${this.width}px`;
  }

  get h() {
    return `${this.height}px`;
  }
}
