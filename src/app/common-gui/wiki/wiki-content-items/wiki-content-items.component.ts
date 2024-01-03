import { Component, Input } from '@angular/core';
import { Content } from '../parser-elements';

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

  isString(item: Content): boolean {
    return typeof item === 'string';
  }

  stringOf(item: Content): string {
    return item as string;
  }

  styleOf(item: Content): string {
    if (typeof item === 'string') {
      return '';
    } else {
      return item.style ?? '';
    }
  }

  tagOf(item: Content): string {
    if (typeof item === 'string') {
      return '';
    } else {
      return item.tag;
    }
  }

  contentOf(item: Content): Content[] {
    if (typeof item === 'string') {
      return [];
    } else {
      return item.content ?? [];
    }
  }

  propertiesOf(item: Content): { [key: string]: string } {
    if (typeof item === 'string') {
      return {};
    } else {
      return item.properties ?? {};
    }
  }
}
