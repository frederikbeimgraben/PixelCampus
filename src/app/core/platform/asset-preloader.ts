import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Sprites that make up the GUI chrome. They are all tiny and all needed as soon
 * as a panel opens, so fetching them up front removes the visible tearing that
 * happened when a popup drew its border one image at a time.
 */
const GUI_SPRITES: readonly string[] = [
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

/**
 * Warms the browser cache for sprites the UI needs shortly after start-up.
 *
 * The old landing component did this in its constructor with a bare `new Image()`
 * loop, which competed with the initial render for bandwidth. Here the work is
 * deferred to the first idle slot, so it never delays first paint.
 */
@Injectable({ providedIn: 'root' })
export class AssetPreloader {
  private readonly document = inject(DOCUMENT);
  private started = false;

  /** Queues the preload. Repeat calls are ignored. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.whenIdle(() => {
      for (const url of [...GUI_SPRITES, ...PING_SPRITES]) {
        this.prefetch(url);
      }
    });
  }

  /**
   * Adds `<link rel=prefetch>` rather than constructing an Image, so the browser
   * schedules the fetch at the lowest priority and it never competes with content.
   */
  private prefetch(url: string): void {
    const link = this.document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = url;
    this.document.head.appendChild(link);
  }

  private whenIdle(task: () => void): void {
    const view = this.document.defaultView;
    if (!view) return;

    // Safari only gained requestIdleCallback recently, so fall back to a timer.
    const idle: typeof view.requestIdleCallback | undefined = view.requestIdleCallback;
    if (typeof idle === 'function') {
      idle.call(view, task, { timeout: 3000 });
    } else {
      view.setTimeout(task, 500);
    }
  }
}
