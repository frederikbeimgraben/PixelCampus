import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-version-info',
  templateUrl: './version-info.component.html',
  styleUrl: './version-info.component.scss'
})
export class VersionInfoComponent {
  @Input() version: string | undefined;
}
