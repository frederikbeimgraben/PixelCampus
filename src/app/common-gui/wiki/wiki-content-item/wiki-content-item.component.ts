import { Component, Input } from '@angular/core';
import { WikiItem, parse, Content, Extra } from '../wiki-item';

@Component({
  selector: 'app-wiki-content-item',
  templateUrl: './wiki-content-item.component.html',
  styleUrl: './wiki-content-item.component.scss'
})
export class WikiContentItemComponent {
  @Input() content: Content = '';

  private _id: string = '';

  get isString(): boolean {
    return typeof this.content === 'string';
  }

  get isExtra(): boolean {
    return !this.isString;
  }

  get extra(): Extra {
    return this.content as Extra;
  }

  get tag(): string {
    return this.extra.tag;
  }

  get extraContent(): Content[] {
    return this.extra.content ?? [];
  }

  get string(): string {
    return this.content as string;
  }

  get properties(): { [key: string]: string } {
    return this.extra.properties ?? {};
  }

  get id(): string {
    if (this._id === '') {
      this._id = Math.random().toString(36).substring(2, 15);
    }

    return this._id;
  }
}
