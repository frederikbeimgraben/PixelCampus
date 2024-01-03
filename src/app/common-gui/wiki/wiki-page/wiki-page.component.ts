import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-wiki-page',
  templateUrl: './wiki-page.component.html',
  styleUrl: './wiki-page.component.scss'
})
export class WikiPageComponent {
  @Input() title: string = "Wiki";
  @Input() shadowType?: boolean = false;
}
