import { Injectable, inject } from '@angular/core';

import { Viewport } from './viewport';

const CLICK_SOUND_URL = '/assets/sounds/click.mp3';

/** Point in the file where the actual click starts; the head of the file is silence. */
const CLICK_OFFSET_SECONDS = 0.5;

/**
 * Plays the Minecraft click sound.
 *
 * The old code built a fresh `Audio` object on every click in three separate
 * components, so each click re-fetched the file and the same mobile check was
 * copy-pasted three times.
 */
@Injectable({ providedIn: 'root' })
export class ClickSound {
  private readonly viewport = inject(Viewport);
  private template: HTMLAudioElement | null = null;

  /** Downloads and decodes the sound so the first click is not silent. */
  preload(): void {
    if (this.template !== null || typeof Audio === 'undefined') {
      return;
    }

    this.template = new Audio(CLICK_SOUND_URL);
    this.template.preload = 'auto';
    this.template.load();
  }

  /** Plays one click. Does nothing on touch devices, where the sound is unwanted. */
  play(): void {
    if (this.viewport.isTouch() || typeof Audio === 'undefined') {
      return;
    }

    this.preload();

    // Cloning lets rapid clicks overlap instead of cutting each other off.
    const sound = this.template?.cloneNode() as HTMLAudioElement | undefined;
    if (!sound) return;

    sound.currentTime = CLICK_OFFSET_SECONDS;

    // Autoplay policy rejects playback that is not tied to a gesture. That is a
    // normal outcome here, not an error worth surfacing.
    void sound.play().catch(() => undefined);
  }
}
