import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-navigator',
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  @Output() showPopup: EventEmitter<any> = new EventEmitter();
  @Output() showWiki: EventEmitter<any> = new EventEmitter();

  title = 'PixelCampus';

  cool: boolean = false;

  items: {
    [key: string]: {
      item: any | undefined,
      name: string,
      target: string | undefined
    }
  } = {
    bluemap: {
      item: undefined,
      name: 'bluemap',
      target: 'https://map.pixelcampus.space/'
    },
    server: {
      item: undefined,
      name: 'server',
      target: undefined
    },
    discord: {
      item: undefined,
      name: 'discord',
      target: 'https://discord.gg/HQGBwFA3vD'
    },
    wiki: {
      item: undefined,
      name: 'wiki',
      target: 'https://wiki.pixelcampus.space/'
    },
  };

  itemTimers: {
    [key: string]: number
  } = {};

  selectItem(name: string) {
    if (name == 'server') {
      this.showPopup.emit();
      return;
    }
    
    const item = this.items[name].item;
    if (item != undefined)
      // Open the link in a new tab
      window.open(this.items[name].target, '_blank');
  }

  playClickSound() {
    // If on mobile, don't play the sound
    if (navigator.userAgent.match(/Android/i) ||
        navigator.userAgent.match(/webOS/i) ||
        navigator.userAgent.match(/iPhone/i) ||
        navigator.userAgent.match(/iPad/i) ||
        navigator.userAgent.match(/iPod/i) ||
        navigator.userAgent.match(/BlackBerry/i) ||
        navigator.userAgent.match(/Windows Phone/i))
      return;

    const audio = new Audio();
    audio.src = '/assets/sounds/click.mp3';
    audio.load();

    // play from 500ms to ...
    audio.currentTime = 0.5;

    audio.play();
  }

  activate(name: string) {
    if (this.cool)
      return;

    this.playClickSound();

    const item = this.items[name].item;
    if (item != undefined)
      item.activate();
    for (const key in this.items) {
      if (key != name) {
        const item = this.items[key].item;
        if (item != undefined)
          item.deactivate();
      }
    }

    if (this.itemTimers[name] != undefined && this.itemTimers[name] != 0) {
      let diff = Date.now() - this.itemTimers[name];

      if (diff < 500) {
        // Select the item
        this.selectItem(name);

        return;
      }
    }

    this.itemTimers[name] = Date.now();

    this.cool = true;

    setTimeout(() => {
      this.cool = false;
    }, 100);
  }

  deactivate() {
    for (const key in this.items) {
      const item = this.items[key].item;
      if (item != undefined)
        item.deactivate();
    }
  }

  registerBanner(item: any, name: string) {
    this.items[name].item = item;
    return name;
  }
}
