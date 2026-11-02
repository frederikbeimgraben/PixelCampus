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
import { AssetLoader } from '../../../core/platform/asset-loader';

/** Loaded lazily so three.js stays out of the initial bundle. */
type SkinViewerModule = typeof import('skinview3d');

/** Turn away from the camera, in radians: about 30 degrees. */
const THREE_QUARTER_TURN = Math.PI / 6;

/** A few degrees of downward tilt, so the figure is not seen dead level. */
const SLIGHT_TILT = -0.08;

/**
 * The classic default skin, served from this origin.
 *
 * Loaded only when the player's own skin does not load, so the figure is never
 * a blank model. It must not be loaded first: skinview3d loads both
 * asynchronously, and when Steve arrived after the player's skin, Steve
 * replaced it. The loading screen covers the wait instead.
 */
const DEFAULT_SKIN = '/assets/player/wide_steve.png';

/**
 * The player's skin as a rotatable 3D figure.
 *
 * This does not draw armor. skinview3d renders only the skin, cape and elytra.
 * The equipment slots beside it show what the player wears.
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

  private viewer: {
    loadSkin: (url: string) => Promise<void> | void;
    dispose: () => void;
  } | null = null;

  /*
   * The loading screen stays up until the player's own skin is on the figure,
   * so the visitor never sees Steve first. The loader releases a hold after a
   * few seconds on its own, so a skin that never loads does not keep it up.
   */
  private readonly assets = inject(AssetLoader);
  private release = this.assets.hold();

  constructor() {
    // three.js touches the DOM and WebGL, so it must not run during server
    // rendering; afterNextRender only fires in the browser.
    afterNextRender(() => void this.create().finally(() => this.release()));

    inject(DestroyRef).onDestroy(() => {
      this.release();
      this.viewer?.dispose();
    });

    effect(() => {
      const url = this.api.skinUrl(this.uuid(), 'texture');
      const viewer = this.viewer;
      if (viewer === null) return;

      this.release();
      const release = (this.release = this.assets.hold());
      void this.loadSkinOrDefault(viewer, url).finally(release);
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
      });

      viewer.animation = new skinview3d.IdleAnimation();
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;
      viewer.zoom = 0.8;

      // Three-quarter view rather than face-on: a straight-on figure is flat
      // and hides the model's depth. Dragging still rotates from here.
      viewer.playerObject.rotation.y = THREE_QUARTER_TURN;
      viewer.playerWrapper.rotation.x = SLIGHT_TILT;

      this.viewer = viewer;
      await this.loadSkinOrDefault(viewer, this.api.skinUrl(this.uuid(), 'texture'));
      this.ready.set(true);
    } catch {
      // No WebGL, or a texture that is not a skin.
      this.failed.set(true);
    }
  }

  /**
   * Puts the player's skin on the figure, or Steve if it does not load. A
   * missing skin is not an error.
   */
  private async loadSkinOrDefault(
    viewer: { loadSkin: (url: string) => Promise<void> | void },
    url: string,
  ): Promise<void> {
    try {
      await viewer.loadSkin(url);
    } catch {
      await Promise.resolve(viewer.loadSkin(DEFAULT_SKIN)).catch(() => undefined);
    }
  }
}
