import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';
import { MinecraftTooltipComponent } from '../../../../minecraft-tooltip/minecraft-tooltip.component';

const keys = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-latency',
  standalone: true,
  imports: [
    SharedModule,
    MinecraftTooltipComponent
  ],
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
