import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Observable, first, interval } from 'rxjs';

@Component({
    selector: 'app-minecraft-banner',
    templateUrl: './minecraft-banner.component.html',
    styleUrl: './minecraft-banner.component.scss',
})
export class MinecraftBannerComponent {
  @Input() customTitle: string | undefined;
  @Input() customDescription: string | undefined;
  @Input() customFavicon: string | undefined;
  @Input() customLatency: number | undefined;
  @Input() customPlayerCount: number | undefined;
  @Input() customMaxPlayerCount: number | undefined;

  get customized() {
    return (
      this.customTitle !== undefined ||
      this.customDescription !== undefined ||
      this.customFavicon !== undefined ||
      this.customLatency !== undefined ||
      this.customPlayerCount !== undefined ||
      this.customMaxPlayerCount !== undefined
    );
  }

  @Output() ClickAction: EventEmitter<any> = new EventEmitter();

  public serverName = 'PixelCampus';
  public serverVersion?: string = undefined;
  public serverDescription: Formatted[] = [];

  public playerCount = 0;
  public maxPlayerCount = 0;
  public players: string[] = [];

  public latency = 0;

  public favicon = 'https://api.pixelcampus.space/api/minecraft/self_ping';

  container: HTMLElement | null = null;

  public statusJSON: any | undefined;

  constructor() {
    if (!this.customized)
      this.fetchServerInfo();
  }

  public registerContainer(element: HTMLElement) {
    this.container = element;
    return 'container';
  }

  public activate() {
    if (this.container != null) {
      // Set background tint to black
      this.container.style.backgroundColor = 'rgba(0, 0, 0, 1)';

      // Set white border (4px)
      this.container.style.border = '4px solid white';
    }
  }

  public deactivate() {
    if (this.container != null) {
      // Set background tint to transparent
      this.container.style.backgroundColor = 'rgba(0, 0, 0, 0)';

      // Reset border
      this.container.style.border = '4px solid transparent';
    }
  }

  public getServerPing() {
    // Get Ping to the Angular Server (to add to the Minecraft Server Ping)
    const ping = this.latency;
  }

  public fetchServerInfo() {
    fetch('https://api.pixelcampus.space/api/minecraft/status')
      .then(response => response.json())
      .then(data => {
        try {
          this.statusJSON = data.data ?? {};

          this.latency = this.statusJSON?.latency ?? 0;

          const status = this.statusJSON?.status ?? {};

          const description = new MinecraftText(status?.description ?? {});

          this.serverDescription = description.toFormatted();

          const players = status?.players ?? {};

          this.playerCount = players?.online ?? 0;
          this.maxPlayerCount = players?.max ?? 0;
          this.players = players?.sample?.map(
            (player: any) => player?.name
          ) ?? [];

          const version = status?.version ?? '???';

          this.serverVersion = version?.name ?? '???';
        } catch (error) {
          console.error(error);
          this.latency = 0;
        }
      });
  }
}


interface Formatted {
  text: string;
  color: string;
  fontFamily?: string;
}

class MinecraftText {
  extra?: MinecraftText[];
  color?: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  [key: string]: any;

  constructor(json: any) {
    if (json['extra']) {
      this.extra = [];
      for (const extra of json['extra']) {
        this.extra.push(new MinecraftText(extra));
      }
    }

    for (const key of Object.keys(json)) {
      if (key !== 'extra') {
        this[key] = json[key];
      }
    }
  }

  public toFormatted() {
    let result: Formatted[] = [];

    if (this.extra) {
      for (const extra of this.extra) {
        result.push(...extra.toFormatted());
      }
    }

    const color = this.color || 'white';
    let fontFamily;

    switch (
      (this.bold ? 1 : 0) + 
      (this.italic ? 2 : 0)
    ) {
      case 3:
        fontFamily = 'Minecraft Bold Italic';
        break;
      case 1:
        fontFamily = 'Minecraft Bold';
        break;
      case 2:
        fontFamily = 'Minecraft Italic';
        break;
      default:
        fontFamily = 'Minecraft Regular';
        break;
    }

    if (this.text) {
      // Create HTML element
      const element = {
        text: this.text,
        color: color,
        fontFamily: fontFamily
      }

      // Add to HTML
      result.push(element);
    }

    return result;
  }
}
