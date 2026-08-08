import type { PlayerGear } from './models.js';

/** Gear as it was when the player was last seen wearing it. */
export interface RememberedGear {
  readonly gear: PlayerGear;
  /** When it was read, ISO 8601. */
  readonly capturedAt: string;
}

/**
 * Remembers the last gear seen on each player.
 *
 * Only the live server reports gear. A player who logs off would have nothing
 * to show. The last reading keeps a profile useful between sessions.
 *
 * The cache is in memory. A restart forgets everything, and those players show
 * no gear until they log in again. Storage would need a layer this service does
 * not have.
 */
export class GearCache {
  private readonly entries = new Map<string, RememberedGear>();

  constructor(private readonly capacity = 5000) {}

  /**
   * @param uuid Player UUID.
   * @param gear Gear just read from the live server.
   * @param at Capture time. Defaults to now.
   */
  remember(uuid: string, gear: PlayerGear, at: Date = new Date()): void {
    if (uuid === '') return;

    // Re-inserting moves the key to the end, which makes the first key the
    // least recently written and so the one to drop.
    this.entries.delete(uuid);
    this.entries.set(uuid, { gear, capturedAt: at.toISOString() });

    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }

  /**
   * @param uuid Player UUID.
   * @returns The last gear seen on that player, or null if none was.
   */
  recall(uuid: string): RememberedGear | null {
    return this.entries.get(uuid) ?? null;
  }

  get size(): number {
    return this.entries.size;
  }
}
