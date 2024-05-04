import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { WikiItem } from '../wiki-ui.module'

@Component({
  selector: 'app-side-navigator',
  templateUrl: './side-navigator.component.html',
  styleUrl: './side-navigator.component.scss'
})
export class SideNavigatorComponent {
  @Input() pages: WikiItem[] = [];
  @Input() isMobile?: boolean = false;
  @Input() index: number = 0;

  @Output() indexChange = new EventEmitter<number>();
  @Output() shownChange = new EventEmitter<boolean>();

  tempIndex: number = 0;
  show: boolean = false;
  userAgent = navigator.userAgent || navigator.vendor;

  constructor(
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    
  }

  onItemClick(item: WikiItem) {
    this.pages?.forEach((item) => {
      item.active = false;
    });

    if (this.isMobile) {
      this.hide();
    }

    item.active = true;
    this.index = item.index;

    this.changeDetectorRef.detectChanges();

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

    this.emitShowChange();
  }

  goHome() {
    // Redirect to home page (/)
    window.location.href = '/';
  }

  get ready(): boolean {
    return this.pages != undefined && this.pages.length > 0;
  }

  get currentIcon(): string {
    if (this.ready) {
      return this.pages![this.index].icon;
    } else {
      return '';
    }
  }
}