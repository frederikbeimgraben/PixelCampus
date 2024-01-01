import { Component } from '@angular/core';

@Component({
  selector: 'app-wiki',
  templateUrl: './wiki.component.html',
  styleUrl: './wiki.component.scss'
})
export class WikiComponent {
  pages = [
    'Home',
    'Test Page 1',
    'Test Page 2',
    'Test Page 3',
    'Test Page 4',
  ]
}
