import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-wiki-page',
  templateUrl: './wiki-page.component.html',
  styleUrl: './wiki-page.component.scss'
})
export class WikiPageComponent {
  @Input() title: string = "Wiki";
  @Input() shadowType?: boolean = false;
  @Input() isMobile?: boolean = false;

  get shadowClasses(): string {
    if (this.isMobile) {
      return 'shadow-nav-mobile'
    } else {
      if (this.shadowType) {
        return 'shadow-nav-expanded'
      } else {
        return 'shadow-nav-closed'
      }
    }
  }
}
