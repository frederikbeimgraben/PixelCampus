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
 * Gear can only be read from the live server, so a player who logs off would
 * otherwise have no equipment to show at all. Keeping the last reading means a
 * profile stays useful between sessions.
 *
 * In memory, so a restart forgets everything and those players show no gear
 * until they next log in. Persisting it needs a storage layer this service does
 * not have yet.
 */
export class GearCache {
  private readonly entries = new Map<string, RememberedGear>();

  constructor(private readonly capacity = 5000) {}

  /**
   * @param uuid Player UUID.
   * @param gear Gear just read from the live server.
   * @param at Capture time; defaults to now.
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
