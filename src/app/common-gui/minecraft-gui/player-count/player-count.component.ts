import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-player-count',
  templateUrl: './player-count.component.html',
  styleUrl: './player-count.component.scss'
})
export class PlayerCountComponent {
  @Input() playerCount: number = 0;
  @Input() maxPlayerCount: number = 100;
  @Input() latency: number = 0;
  @Input() players: string[] = [];

  tooltip: HTMLElement | null = null;

  showTooltip: boolean = false;

  constructor() {}

  ngOnInit() {}

  registerTooltip(element: HTMLElement) {
    this.tooltip = element;
    return 'tooltip';
  }

  onHoverPlayerCount() {
    if (this.players.length > 0)
      this.showTooltip = true;

    if (this.tooltip != undefined) {
      const height = `${this.players.length * 20 + 6}px`
      this.tooltip.style.height = height;
      this.tooltip.style.backgroundSize = `100% ${height}`;
    }
  }

  onLeavePlayerCount() {
    this.showTooltip = false;
  }

  calcTooltipPosition(x: number, y: number): [number, number] {
    return [
      x - 200,
      y - (this.players.length * 20 + 6) - 38
    ]
  }

  playersList() {
    return this.players
      .slice(0, 2)
      .map(player => player.slice(0, 16) + (player.length > 16 ? '...' : ''))
  }

  moveTooltipEvent(event: MouseEvent) {
    let [x, y] = this.calcTooltipPosition(
      event.clientX,
      event.clientY
    );

    if (this.tooltip != undefined) {
      this.tooltip.style.left = x + 'px';
      this.tooltip.style.top = y + 'px';
    }
  }
}
