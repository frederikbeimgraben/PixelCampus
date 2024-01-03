import { Component } from '@angular/core';

const content = `
# Wiki Home

![Image](https://picsum.photos/seed/picsum/200/300)

[Link](https://www.google.com)

## Subtitle

### Subsubtitle

****Edge Test****

***Bold and Italic***

**Bold**

*Italic*

<button>Button</button>
`;

@Component({
  selector: 'app-wiki',
  templateUrl: './wiki.component.html',
  styleUrl: './wiki.component.scss'
})
export class WikiComponent {
  pages: string[] = [
    'Wiki Home',
  ]
  page: number = 0;

  navShown: boolean = false;

  content: string = content;

  pageChanged(index: number) {
    this.page = index;
  }
}
