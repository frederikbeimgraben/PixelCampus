import { ChangeDetectorRef, Component, HostListener, EventEmitter } from '@angular/core';
import { Content, parser } from '../common-gui/wiki/parser';
import { WikiItem } from '../common-gui/wiki/wiki-item';

const endPoint = 'https://api.pixelcampus.space/api/wiki';

const iconEndPoint = 'https://api.pixelcampus.space/static';

@Component({
  selector: 'app-wiki',
  templateUrl: './wiki.component.html',
  styleUrl: './wiki.component.scss'
})
export class WikiComponent {
  index: number = 0;

  navShown: boolean = false;

  indexChangeEmitter = new EventEmitter<number>();

  _pages: {
    title: string,
    content: Content[],
    icon?: string
  }[] = [];

  _sitemap?: { 
    index: string,
    pages: {
      title: string,
      path: string,
      icon?: string
    }[]
  };

  // Init function
  constructor(
    private changeDetectorRef: ChangeDetectorRef
  ) {
    
  }

  lastSize: number = window.innerWidth;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.lastSize < 700 && window.innerWidth >= 700) {
      this.changeDetectorRef.detectChanges();
    }
    
    if (this.lastSize >= 700 && window.innerWidth < 700) {
      this.changeDetectorRef.detectChanges();
    }
  }

  async ngAfterViewInit() {
    // Wait for the pages to be loaded
    await fetch(endPoint)
      .then(res => res.json())
      .then(async res => {
      this._sitemap = res?.data;
      
      let pages = [
        {
          title: 'Wiki Home',
          path: this._sitemap?.index ?? '',
        },
        ...(this._sitemap?.pages ?? []),
      ]

      console.log(pages);

      // Load the pages
      for (let page of pages) {
        let url = `${endPoint}/${page.path}`;

        console.debug(`Loading page ${page.title} from ${url}`);

        await fetch(url)
          .then(async res => {
            let text = await res.text();
            let icon;

            // Try to evaluate as JSON
            try {
              let status = await res?.status;
              
              if (status >= 400) {
                return;
              }
            } catch (e) {
              // Do nothing
            }

            if (page.icon?.startsWith('http') || page.icon == undefined) {
              icon = page.icon;
            } else {
              icon = `${iconEndPoint}${page.icon}`;
            }

            this._pages.push({
              title: page.title,
              content: parser(text),
              icon: icon
            });
          });
      }

      console.log(this._pages);
    });

    // Get the page from the URL
    let page = window.location.hash.substring(1).toLowerCase();


    if (page == '') {
      window.location.hash = 'wiki-home';

      this.index = 0;
    } else {
      // Rewrite the URL hash
      window.location.hash = page;

      // Find the page
      for (let i = 0; i < this._pages.length; i++) {
        if (this.hashOf(this._pages[i].title) == page) {
          this.index = i;

          this.indexChangeEmitter.emit(this.index);

          break;
        }
      }
    }    

    // Force update
    this.changeDetectorRef.detectChanges();
  }

  // Getter for the pages
  get parsed(): Content[] {
    if (this._pages[this.index]) return this._pages[this.index].content;

    return [];
  }

  get pages(): WikiItem[] {
    return this._pages.map(
      (item, index) => {
        return new WikiItem(
          index,
          index,
          item.title,
          false,
          item.icon ?? '/assets/items/compass_01.png',
          ''
        )
      }
    );
  }

  get titles(): string[] {
    return this._pages.map(
      (item) => {
        return item.title;
      }
    );
  }

  hashOf(title: string): string {
    return title.toLowerCase().replaceAll(' ', '-');
  }

  pageChanged(index: number) {
    this.index = index;

    // Rewrite the URL hash
    window.location.hash = this.hashOf(
      this._pages[index].title
    );
  }

  get isMobile() {
    let widthTrigger = window.innerWidth < 700;

    let userAgentTrigger = navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i) != null;

    return widthTrigger || userAgentTrigger;
  }
}
