import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-minecraft-popup',
  standalone: true,
  imports: [],
  templateUrl: './minecraft-popup.component.html',
  styleUrl: './minecraft-popup.component.scss'
})
export class MinecraftPopupComponent {
  @Input() content: string | undefined;
  
  constructor() {}

  ngOnInit() {}
}
