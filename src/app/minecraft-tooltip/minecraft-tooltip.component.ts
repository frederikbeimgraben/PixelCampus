import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-minecraft-tooltip',
  standalone: true,
  imports: [],
  templateUrl: './minecraft-tooltip.component.html',
  styleUrl: './minecraft-tooltip.component.scss'
})
export class MinecraftTooltipComponent {
  @Input() content: string | undefined;

  @Output() ClickAction: EventEmitter<any> = new EventEmitter();

  button: HTMLElement | null = null;
  
  constructor() {}

  ngOnInit() {}
}
