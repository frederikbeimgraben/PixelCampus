import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-wiki-navigation-panel',
  templateUrl: './wiki-navigation-panel.component.html',
  styleUrl: './wiki-navigation-panel.component.scss'
})
export class WikiNavigationPanelComponent {
  title: string = "Wiki";

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  menuItems: any[] = [
    { name: "Home", icon: "home", link: "/wiki/home" }
  ];

  constructor(private breakpointObserver: BreakpointObserver) { }
}
