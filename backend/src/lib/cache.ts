interface Entry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

/**
 * In-memory TTL cache with single-flight loading.
 *
 * The game server is the same machine that serves players, so a burst of page
 * views must not become a burst of plugin queries. Concurrent misses for one
 * key share a single upstream request.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  /**
   * @param key Cache key.
   * @param load Called on a miss; concurrent misses share one call.
   * @returns The cached or freshly loaded value.
   */
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }

    const promise = load()
      .then((value) => {
        if (this.ttlMs > 0) {
          this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        }
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
  }

  /** Drops expired entries; call periodically so keys that stop being requested are freed. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
