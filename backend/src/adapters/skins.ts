import type { Config } from '../config.js';
import { TtlCache } from '../lib/cache.js';
import { fetchBinary, type BinaryResponse } from '../lib/http.js';

export type SkinView = 'head' | 'body' | 'texture';

const VIEW_PATH: Readonly<Record<SkinView, string>> = {
  head: 'avatars',
  body: 'renders/body',
  // The raw 64x64 skin, which the 3D viewer needs; the others are renders.
  texture: 'skins',
};

/**
 * Proxies rendered skins.
 *
 * The browser never contacts the render service directly: that keeps the site's
 * connect-src and img-src policies limited to this origin, and stops a third
 * party from seeing which visitor looked at which player.
 */
export class SkinAdapter {
  private readonly cache: TtlCache<BinaryResponse | null>;

  constructor(private readonly config: Config) {
    this.cache = new TtlCache(config.SKIN_CACHE_TTL_SECONDS * 1000);
  }

  /**
   * @param uuid Player UUID.
   * @param view Head icon or full body render.
   * @param size Requested pixel size.
   * @returns The image, or null when the render service has no skin for the UUID.
   * @throws {UpstreamError} If the render service is unreachable.
   */
  async render(uuid: string, view: SkinView, size: number): Promise<BinaryResponse | null> {
    const key = `${view}:${uuid}:${size}`;

    return this.cache.get(key, () =>
      fetchBinary(
        `${trimSlash(this.config.SKIN_RENDER_URL)}/${VIEW_PATH[view]}/${encodeURIComponent(uuid)}?size=${size}&overlay`,
        {
          timeoutMs: this.config.UPSTREAM_TIMEOUT_MS,
          upstream: 'skin renderer',
          headers: { accept: 'image/png' },
        },
      ),
    );
  }
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
