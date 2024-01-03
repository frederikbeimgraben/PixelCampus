import { Component, Input } from '@angular/core';
import { Content } from '../wiki-item';

@Component({
  selector: 'app-wiki-content-items',
  templateUrl: './wiki-content-items.component.html',
  styleUrl: './wiki-content-items.component.scss'
})
export class WikiContentItemsComponent {
  @Input() items: Content[] = [];

  identifierOf(item: Content): string {
    if (typeof item === 'string') {
      return item;
    } else {
      return item.tag;
    }
  }
}
