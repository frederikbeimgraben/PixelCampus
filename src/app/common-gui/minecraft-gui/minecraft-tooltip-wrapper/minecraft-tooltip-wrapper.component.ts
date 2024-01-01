import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MinecraftTooltipComponent } from '../minecraft-tooltip/minecraft-tooltip.component';

const textSize: number = 8.5 * 2.5;

@Component({
  selector: 'app-minecraft-tooltip-wrapper',
  templateUrl: './minecraft-tooltip-wrapper.component.html',
  styleUrl: './minecraft-tooltip-wrapper.component.scss'
})
export class MinecraftTooltipWrapperComponent {
  @Input() showTooltip: boolean = true;
  @Input() content: string[] = [];

  @ViewChild('tooltip', { read: ElementRef }) tooltip: ElementRef | undefined;
  @ViewChild('wrapped', { read: ElementRef }) wrapped: ElementRef | undefined;

  constructor() {}

  display: boolean = false;

  tooltipContentHeight() {
    return this.content.length * textSize + 6;
  }

  tooltipContentWidth() {
    return Math.max(...this.content.map(line => line.length)) * textSize * 3/5 + 6;
  }

  onHoverContent() {
    this.display = true;
  }

  onLeaveContent() {
    this.display = false;
  }

  calcTooltipPosition(x: number, y: number): [number, number] {
    let tooltip = this.tooltip?.nativeElement as HTMLElement;

    // Get first child of tooltip
    tooltip = tooltip.children[0] as HTMLElement;

    x -= tooltip.offsetWidth - 4

    // Calculate if the tooltip would overflow the screen
    if (x + tooltip.offsetWidth > window.innerWidth)
      x = window.innerWidth - tooltip.offsetWidth - 4;

    return [
      x,
      y - tooltip.offsetHeight - 4
    ]
  }

  xPosition: number = 0;
  yPosition: number = 0;

  moveTooltipEvent(event: MouseEvent) {
    // Check we are still above the content (this.wrapped)
    if (this.wrapped == undefined)
      return;

    if (!this.wrapped.nativeElement.contains(event.target))
      this.onLeaveContent()

    let [x, y] = this.calcTooltipPosition(
      event.clientX,
      event.clientY
    );

    this.xPosition = x;
    this.yPosition = y;
  }
}
