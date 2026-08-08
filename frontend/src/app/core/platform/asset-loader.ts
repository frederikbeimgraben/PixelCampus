import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

/**
 * Sprites that make up the GUI chrome.
 *
 * They are all small and all needed the moment a panel opens. Without them a
 * popup drew its border one image at a time, and the edge tore.
 */
const GUI_SPRITES: readonly string[] = [
  '/assets/background/background-180.png',
  '/assets/popup/card.png',
  '/assets/popup/card-tl.png',
  '/assets/popup/card-tr.png',
  '/assets/popup/card-bl.png',
  '/assets/popup/card-br.png',
  '/assets/popup/card-top.png',
  '/assets/popup/card-bottom.png',
  '/assets/popup/card-left.png',
  '/assets/popup/card-right.png',
  '/assets/popup/card-content.png',
  '/assets/tooltip/border-horizontal.png',
  '/assets/tooltip/border-vertical.png',
  '/assets/tooltip/inner-border-horizontal.png',
  '/assets/tooltip/inner.png',
  '/assets/tooltip/latency_background.png',
  '/assets/button/background.png',
  '/assets/button/border-top.png',
  '/assets/button/border-bottom.png',
  '/assets/button/border-left.png',
  '/assets/button/border-right.png',
];

/** Ping bars, needed the moment the server status arrives. */
const PING_SPRITES: readonly string[] = [
  '/assets/ping/background.png',
  '/assets/ping/unreachable.png',
  '/assets/ping/ping_1.png',
  '/assets/ping/ping_2.png',
  '/assets/ping/ping_3.png',
  '/assets/ping/ping_4.png',
  '/assets/ping/ping_5.png',
];

/** The faces the interface is set in. */
const FONTS: readonly string[] = [
  '20px "Minecraft Regular"',
  '20px "Minecraft Bold"',
  '20px "Minecraft Italic"',
];

/**
 * Longest the site waits before showing itself anyway.
 *
 * A sprite that never arrives must not leave the page behind a loading screen
 * for ever. The page renders without them; they are only ever an improvement.
 *
 * loading-screen.scss hides the screen at the same point without any script, in
 * case none is running at all.
 */
const GIVE_UP_MS = 5000;

/**
 * Loads the sprites and faces the interface is drawn with, and reports how far
 * along it is.
 *
 * The page arrives rendered. The game font and the panel sprites arrive after
 * it. The first frame showed the right layout in the wrong typeface, with flat
 * boxes in place of the GUI.
 *
 * The loading screen hides that wait, as the game does. The visitor sees one
 * finished frame instead of an unfinished one that corrects itself.
 */
@Injectable({ providedIn: 'root' })
export class AssetLoader {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly total = GUI_SPRITES.length + PING_SPRITES.length + FONTS.length;
  private readonly done = signal(0);
  private readonly givenUp = signal(false);

  /** How much has arrived, from 0 to 1. */
  readonly progress = computed(() => (this.givenUp() ? 1 : this.done() / this.total));

  /** Whether the interface can be shown. */
  readonly ready = computed(() => this.progress() >= 1);

  private started = false;

  /** Starts loading. Repeat calls are ignored. */
  start(): void {
    if (this.started || !this.browser) return;
    this.started = true;

    for (const url of [...GUI_SPRITES, ...PING_SPRITES]) {
      this.load(url);
    }

    this.loadFonts();

    setTimeout(() => this.givenUp.set(true), GIVE_UP_MS);
  }

  private load(url: string): void {
    const image = new Image();

    // A failed sprite counts as done. The page is no worse off, and one 404
    // must not hold the loading screen at 90 percent.
    const settled = (): void => this.done.update((count) => count + 1);
    image.addEventListener('load', settled, { once: true });
    image.addEventListener('error', settled, { once: true });

    image.src = url;
  }

  private loadFonts(): void {
    const fonts = document.fonts as FontFaceSet | undefined;

    if (fonts === undefined) {
      this.done.update((count) => count + FONTS.length);
      return;
    }

    for (const face of FONTS) {
      void fonts
        .load(face)
        .catch(() => undefined)
        .finally(() => this.done.update((count) => count + 1));
    }
  }
}
