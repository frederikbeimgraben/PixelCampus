import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { StatsApi } from '../../../core/api/stats-api';

/** Loaded lazily so three.js stays out of the initial bundle. */
type SkinViewerModule = typeof import('skinview3d');

/**
 * The player's skin as a rotatable 3D figure.
 *
 * Armour is not drawn: skinview3d renders the skin, cape and elytra only, so
 * the equipment slots beside this are what show what the player is wearing.
 */
@Component({
  selector: 'app-player-skin',
  templateUrl: './player-skin.html',
  styleUrl: './player-skin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerSkin {
  readonly uuid = input.required<string>();
  readonly name = input<string>('');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly api = inject(StatsApi);

  /** Set when the texture will not load, so a still image can take over. */
  protected readonly failed = signal(false);
  protected readonly ready = signal(false);

  private viewer: { loadSkin: (url: string | null) => unknown; dispose: () => void } | null = null;

  constructor() {
    // three.js touches the DOM and WebGL, so it must not run during server
    // rendering; afterNextRender only fires in the browser.
    afterNextRender(() => void this.create());

    inject(DestroyRef).onDestroy(() => this.viewer?.dispose());

    effect(() => {
      const url = this.api.skinUrl(this.uuid(), 'texture');
      const viewer = this.viewer;
      if (viewer === null) return;

      try {
        void viewer.loadSkin(url);
      } catch {
        this.failed.set(true);
      }
    });
  }

  /** Still render used when WebGL or the texture is unavailable. */
  protected fallbackUrl(): string {
    return this.api.skinUrl(this.uuid(), 'body', 256);
  }

  private async create(): Promise<void> {
    let skinview3d: SkinViewerModule;

    try {
      skinview3d = await import('skinview3d');
    } catch {
      this.failed.set(true);
      return;
    }

    try {
      const viewer = new skinview3d.SkinViewer({
        canvas: this.canvas().nativeElement,
        width: 200,
        height: 300,
        skin: this.api.skinUrl(this.uuid(), 'texture'),
      });

      viewer.animation = new skinview3d.IdleAnimation();
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;
      viewer.zoom = 0.8;

      this.viewer = viewer;
      this.ready.set(true);
    } catch {
      // No WebGL, or a texture that is not a skin.
      this.failed.set(true);
    }
  }
}
