import { Component, Input } from '@angular/core';
import { WikiItem, parse, Content } from '../wiki-item';

@Component({
  selector: 'app-wiki-content',
  templateUrl: './wiki-content.component.html',
  styleUrl: './wiki-content.component.scss'
})
export class WikiContentComponent {
  @Input() content: string = '';

  parseContent(): string {
    let parsed = parse(this.content);

    console.log(parsed);

    return parsed.toString()
  }

  get parsed(): Content[] {
    let parsed = parse(this.content);

    return parsed;
  }
}
