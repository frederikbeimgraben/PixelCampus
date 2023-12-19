import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-latency',
  templateUrl: './latency.component.html',
  styleUrl: './latency.component.scss'
})
export class LatencyComponent {
  @Input() latency: number = 0;

  tooltip: HTMLElement | null = null;

  showTooltip: boolean = false;

  constructor() {}

  ngOnInit() {}

  get current_index() {
    return 6 - Math.min(
      Math.max(
        Math.floor(this.latency / 20),
        1
      ),
      5
    );
  }

  get latencyText() {
    return `${Math.round(this.latency)} ms`;
  }

  registerTooltip(element: HTMLElement) {
    this.tooltip = element;
    return 'tooltip';
  }

  calcTooltipPosition(x: number, y: number): [number, number] {
    return [
      x - 80,
      y - 64
    ]
  }

  showTooltipEvent(event: MouseEvent) {
    this.moveTooltipEvent(event);

    this.showTooltip = true;
  }

  hideTooltipEvent() {
    this.showTooltip = false;
  }

  moveTooltipEvent(event: MouseEvent) {
    let [x, y] = this.calcTooltipPosition(
      event.clientX,
      event.clientY
    );

    if (this.tooltip != undefined) {
      this.tooltip.style.left = `${x}px`;
      this.tooltip.style.top = `${y}px`;
    }
  }
}
