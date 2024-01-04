import { Component, Input } from '@angular/core';
import { Content } from '../parser-elements';

const resourceEndPoint = 'https://api.pixelcampus.space/static';

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
      let properties = item.properties ?? {};
      return (properties['style'] ?? '');
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

  stringContentOf(item: Content): string {
    if (typeof item === 'string') {
      return item;
    } else {
      return '[Not Displayable]';
    }
  }

  propertiesOf(item: Content): { [key: string]: string } {
    if (typeof item === 'string') {
      return {};
    } else {
      return item.properties ?? {};
    }
  }

  getResourceUrl(resource: string): string {
    if (resource.startsWith('http')) {
      return resource;
    }

    return `${resourceEndPoint}/${resource}`;
  }
}
