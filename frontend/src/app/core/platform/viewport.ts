import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** Width in pixels below which the layout switches to its mobile form. */
const MOBILE_BREAKPOINT_PX = 700;

/**
 * Tracks the viewport and exposes it as signals.
 *
 * Device class comes from a media query. It reports what the browser can do.
 * A user-agent string does not, because browsers falsify it.
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly document = inject(DOCUMENT);

  /*
   * Null while the server renders. This tests the platform, not the document's
   * window. The server DOM has a window, but only part of the interface.
   * matchMedia is missing, and a call to it threw.
   *
   * Nothing rendered reads these values. Only behavior that needs a pointer
   * does. The server defaults never reach the markup, so hydration has nothing
   * to disagree with.
   */
  private readonly window = isPlatformBrowser(inject(PLATFORM_ID))
    ? this.document.defaultView
    : null;

  private readonly widthPx = signal(this.window?.innerWidth ?? 0);
  private readonly heightPx = signal(this.window?.innerHeight ?? 0);
  private readonly coarsePointer = signal(false);

  /** Current viewport width in pixels. */
  readonly width = this.widthPx.asReadonly();
  /** Current viewport height in pixels. */
  readonly height = this.heightPx.asReadonly();

  constructor() {
    if (!this.window) {
      return;
    }

    const onResize = (): void => this.measure();
    this.window.addEventListener('resize', onResize, { passive: true });

    const coarse = this.window.matchMedia('(pointer: coarse)');
    const onPointerChange = (event: MediaQueryListEvent): void =>
      this.coarsePointer.set(event.matches);
    this.coarsePointer.set(coarse.matches);
    coarse.addEventListener('change', onPointerChange);

    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('resize', onResize);
      coarse.removeEventListener('change', onPointerChange);
    });

    this.measure();
  }

  /**
   * True when the layout should use its mobile form: either the viewport is
   * narrow or the primary input is a finger.
   */
  isMobile(): boolean {
    return this.widthPx() < MOBILE_BREAKPOINT_PX || this.coarsePointer();
  }

  /** True when the primary pointing device cannot hover, so hover-only UI is unreachable. */
  isTouch(): boolean {
    return this.coarsePointer();
  }

  private measure(): void {
    if (!this.window) return;

    this.widthPx.set(this.window.innerWidth);
    this.heightPx.set(this.window.innerHeight);

    // Publish the real height as a CSS variable so stylesheets can size to the
    // visible area without any component writing to element.style.
    this.document.documentElement.style.setProperty(
      '--app-viewport-height',
      `${this.window.innerHeight}px`,
    );
  }
}
