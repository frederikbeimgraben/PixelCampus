interface Entry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

/**
 * In-memory TTL cache with single-flight loading.
 *
 * The game server also serves players. A burst of page views must not become
 * a burst of plugin queries. Concurrent misses for one key share one upstream
 * request.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  /**
   * @param key Cache key.
   * @param load Called on a miss. Concurrent misses share one call.
   * @param ttlFor Gives the time to keep this value, in milliseconds. Use it to
   *   hold a value that the upstream sent with an error for less time than a
   *   good one. The TTL of the cache applies when it is not given.
   * @returns The cached or freshly loaded value.
   */
  async get(key: string, load: () => Promise<T>, ttlFor?: (value: T) => number): Promise<T> {
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
        const ttlMs = ttlFor === undefined ? this.ttlMs : ttlFor(value);
        if (ttlMs > 0) {
          this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
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

  /** Drops expired entries. Call this from time to time to free unused keys. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
