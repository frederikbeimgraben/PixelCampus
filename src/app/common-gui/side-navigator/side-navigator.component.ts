import { Component, Input } from '@angular/core';
// Class Objects



@Component({
  selector: 'app-side-navigator',
  templateUrl: './side-navigator.component.html',
  styleUrl: './side-navigator.component.scss'
})
export class SideNavigatorComponent {
  @Input() pages?: string[] = [];

  items: NavigatorItem[] = [];

  constructor() { }

  ngOnInit(): void {
    if (this.pages) {
      this.pages.forEach((page, index) => {
        this.items.push(new NavigatorItem(index, page));
      });
    }
  }

  onItemClick(item: NavigatorItem) {
    this.items.forEach((item) => {
      item.active = false;
    });

    item.active = true;
  }
}

class NavigatorItem {
  id: number | string;
  title_str: string;
  icon_url: string | undefined;
  target: string | undefined;

  active: boolean = false;

  constructor(id: number | string, title_str: string, icon_url?: string, target?: string) {
    this.id = id;
    this.title_str = title_str;
    this.icon_url = icon_url;
    this.target = target;
  }

  get title(): string {
    return this.title_str || '';
  }

  get icon(): string {
    return this.icon_url || '';
  }

  get link(): string {
    return this.target || '';
  }

  get class(): string[] {
    let class_str: string[] = ['nav-item'];
    if (this.active) {
      class_str.push('active');
    }
    return class_str;
  }
}