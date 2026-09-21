import type { Config } from '../config.js';
import { TtlCache } from '../lib/cache.js';
import { fetchBinary, type BinaryResponse } from '../lib/http.js';

export type SkinView = 'head' | 'body' | 'texture';

/**
 * How long an image that came with an error status is kept, in milliseconds.
 * It is short, because the next good render must replace it soon.
 */
export const DEGRADED_TTL_MS = 60_000;

/**
 * Path of each view on the render service.
 *
 * The shape is the one of mc-heads.net: the size is a step of the path, not a
 * query. A service with other paths needs a change here as well as a change of
 * SKIN_RENDER_URL.
 *
 * Crafatar was the service before. It gave the default skin, Alex, for players
 * who have a skin of their own, and marked those answers with status 500.
 */
const VIEW_PATH: Readonly<Record<SkinView, string>> = {
  head: 'avatar',
  body: 'body',
  // The raw skin, which the 3D viewer needs. The others are renders.
  texture: 'skin',
};

/** The raw skin has one size only. A size in the path gives a 404. */
const SIZELESS_VIEWS: ReadonlySet<SkinView> = new Set<SkinView>(['texture']);

/**
 * @param base Root URL of the render service.
 * @param view Head icon, full body render, or the raw texture.
 * @param uuid Player UUID.
 * @param size Requested pixel size.
 * @returns The URL to request.
 */
export function renderUrl(base: string, view: SkinView, uuid: string, size: number): string {
  const path = `${trimSlash(base)}/${VIEW_PATH[view]}/${encodeURIComponent(uuid)}`;
  return SIZELESS_VIEWS.has(view) ? path : `${path}/${size}`;
}

/**
 * Proxies rendered skins.
 *
 * The browser never contacts the render service. This keeps connect-src and
 * img-src limited to this origin. It also stops a third party from seeing
 * which visitor looked at which player.
 */
export class SkinAdapter {
  private readonly cache: TtlCache<BinaryResponse | null>;

  constructor(private readonly config: Config) {
    this.cache = new TtlCache(config.SKIN_CACHE_TTL_SECONDS * 1000);
  }

  /**
   * @param uuid Player UUID.
   * @param view Head icon, full body render, or the raw texture.
   * @param size Requested pixel size.
   * @returns The image, or null when the render service has no skin for the UUID.
   * @throws {UpstreamError} If the render service is unreachable.
   */
  async render(uuid: string, view: SkinView, size: number): Promise<BinaryResponse | null> {
    const key = `${view}:${uuid}:${size}`;

    return this.cache.get(
      key,
      () =>
        fetchBinary(renderUrl(this.config.SKIN_RENDER_URL, view, uuid, size), {
          timeoutMs: this.config.UPSTREAM_TIMEOUT_MS,
          upstream: 'skin renderer',
          headers: { accept: 'image/png' },
        }),
      // An image that came with an error status is kept for a minute, not for
      // a day. The render service recovers, and the good image must follow.
      (image) =>
        image?.degraded === true ? DEGRADED_TTL_MS : this.config.SKIN_CACHE_TTL_SECONDS * 1000,
    );
  }
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
