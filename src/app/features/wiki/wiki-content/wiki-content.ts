import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { API_CONFIG } from '../../../core/api/api-config';
import { MinecraftButton } from '../../../ui/minecraft/button/button';
import { MinecraftPopup } from '../../../ui/minecraft/popup/popup';
import { Content, Element, isText } from '../parser/content';

/** Renders parsed wiki content. */
@Component({
  selector: 'app-wiki-content-items',
  templateUrl: './wiki-content.html',
  styleUrl: './wiki-content.scss',
  imports: [NgTemplateOutlet, MinecraftButton, MinecraftPopup],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiContent {
  readonly items = input<readonly Content[]>([]);

  private readonly config = inject(API_CONFIG);

  protected readonly isText = isText;

  /** Narrows a node to an element for the template. */
  protected asElement(item: Content): Element {
    return item as Element;
  }

  protected textOf(item: Content): string {
    return item as string;
  }

  /**
   * Key for `@for`. Node identity is positional, so the index is the honest
   * choice; the old template keyed on the tag name, which made sibling elements
   * of the same type collide and be re-created on every change.
   */
  protected tagOf(item: Content): string {
    return isText(item) ? '' : item.tag;
  }

  protected styleOf(item: Content): string {
    // Already filtered by the parser's sanitiser.
    return isText(item) ? '' : (item.properties['style'] ?? '');
  }

  protected propertyOf(item: Content, key: string): string {
    return isText(item) ? '' : (item.properties[key] ?? '');
  }

  protected childrenOf(item: Content): readonly Content[] {
    return isText(item) ? [] : item.content;
  }

  /** Resolves a wiki image source against the static file host. */
  protected resourceUrl(resource: string): string {
    if (resource.startsWith('http') || resource.startsWith('/')) {
      return resource;
    }
    return `${this.config.legacyBaseUrl}/static/${resource}`;
  }

  /** True for links that leave the site and therefore need rel protection. */
  protected isExternal(href: string): boolean {
    return href.startsWith('http') || href.startsWith('mailto:');
  }
}
