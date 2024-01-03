import { Component, Input } from '@angular/core';
import { parser, Content } from '../parser';

@Component({
  selector: 'app-wiki-content',
  templateUrl: './wiki-content.component.html',
  styleUrl: './wiki-content.component.scss'
})
export class WikiContentComponent {
  @Input() content: string = '';

  parseContent(): string {
    let parsed = parser(this.content);

    console.log(parsed);

    return parsed.toString()
  }

  get parsed(): Content[] {
    let parsed = parser(this.content);

    return parsed;
  }
}
