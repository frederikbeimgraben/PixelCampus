import { Component } from '@angular/core';

const content = `
<card style="color: white; text-shadow: 2px 2px #3e3e3e; width: 70vw;">
  # Wiki Home

  <card>
    ![Image](https://picsum.photos/seed/picsum/200/300)
  </card>

  [Link](https://www.google.com)

  ## Subtitle

  ### Subsubtitle

  ****Edge Test****

  ***Bold and Italic***

  **Bold**

  *Italic*

  <button target="https://www.google.com">Button</button>
</card>
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
