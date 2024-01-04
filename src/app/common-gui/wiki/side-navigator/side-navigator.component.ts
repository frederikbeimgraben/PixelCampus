import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WikiItem } from '../wiki-ui.module'

@Component({
  selector: 'app-side-navigator',
  templateUrl: './side-navigator.component.html',
  styleUrl: './side-navigator.component.scss'
})
export class SideNavigatorComponent {
  @Input() pages?: WikiItem[] = [];
  @Output() indexChange = new EventEmitter<number>();
  @Output() shownChange = new EventEmitter<boolean>();

  index: number = 0;
  tempIndex: number = 0;
  show: boolean = false;
  userAgent = navigator.userAgent || navigator.vendor;

  get isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(this.userAgent);
  }

  constructor() { }

  ngOnInit(): void {

  }

  onItemClick(item: WikiItem) {
    this.pages?.forEach((item) => {
      item.active = false;
    });

    item.active = true;
    this.index = item.index;

    this.indexChange.emit(this.index);
  }

  emitShowChange() {
    this.shownChange.emit(this.show);
  }

  onEnter() {
    if (this.isMobile) {
      return;
    }
    this.show = true;

    this.emitShowChange();
  }

  get compass(): string {
    // Get selected item index
    let index = (this.tempIndex * 10 + 11) % 32;

    // Convert to 2-digit string (01, 02, ..., 11, ..., 32)
    let index_str = index.toString().padStart(2, '0');

    return `/assets/items/compass_${index_str}.png`
  }

  onShowClick() {
    this.show = !this.show;

    this.emitShowChange();
  }

  onLeave() {
    // If Mobile device, don't hide
    if (this.isMobile) {
      return;
    }
    this.hide()

    this.emitShowChange();
  }

  hide() {
    this.show = false;
  }

  goHome() {
    // Redirect to home page (/)
    window.location.href = '/';
  }

  get ready(): boolean {
    return this.pages != undefined && this.pages.length > 0;
  }
}