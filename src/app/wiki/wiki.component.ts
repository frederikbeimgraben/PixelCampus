import { Component } from '@angular/core';
import { Content, parser } from '../common-gui/wiki/parser';

const content = `
<card style="color: white; text-shadow: 2px 2px #3e3e3e; width: 70vw;">
  <h1 style="margin: 10px;">
    Wiki Home
  </h1>

  <span>
    **This is the home page of the wiki.**
  </span>

  <card style="display: flex;">
    <card style="width: fit-content; align-self: center; width: 300px; display: flex;">
    ![Image](https://picsum.photos/seed/picsum/200/300)
    </card>

    ## Subtitle #

    Test

    <br/><br/>

    <edge-case-test></edge-case-test>

    <card>
      ### Subsubtitle

      #### Subsubsubtitle

      ##### Subsubsubsubtitle

      ###### Subsubsubsubsubtitle

      ####### Subsubsubsubsubsubtitle
    </card>
  </card>

  [Link](https://www.google.com)

  ## Subtitle

  ### Subsubtitle

  ****Edge Test****

  ***Bold and Italic***

  <br/>

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

  _parsed: Content[] = [];

  get parsed(): Content[] {
    if (this._parsed.length === 0) {
      this._parsed = parser(this.content);

      console.log(this._parsed);
    }

    return this._parsed;
  }

  pageChanged(index: number) {
    this.page = index;
  }
}
