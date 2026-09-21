import { UpstreamError } from './errors.js';

export interface FetchOptions {
  readonly timeoutMs: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Name used in error messages. */
  readonly upstream: string;
}

/*
 * This module uses Node's global fetch, not undici request(). fetch applies
 * Content-Encoding. PLAN gzips every response, even when the request does not
 * ask for it. request() returns the compressed bytes, so every PLAN payload
 * failed to parse and the leaderboard came back empty.
 */

/**
 * GETs and decodes a JSON body.
 *
 * Every failure becomes an UpstreamError. A caller does not have to tell a
 * refused connection from a timeout or a bad body.
 *
 * @param url Absolute URL to request.
 * @param options Timeout, headers and the upstream name used in errors.
 * @returns The decoded body, or null on 404.
 * @throws {UpstreamError} On connection failure, timeout, non-2xx or bad JSON.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions,
): Promise<T | null> {
  const response = await get(url, options, 'application/json');
  if (response === null) return null;

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new UpstreamError(
      options.upstream,
      `${options.upstream} sent a body that is not JSON`,
      cause,
    );
  }
}

export interface BinaryResponse {
  readonly body: Buffer;
  readonly contentType: string;
  /**
   * True when the upstream reported an error and sent a usable image with it.
   * The caller must keep such an image for a short time only.
   */
  readonly degraded: boolean;
}

/** The first eight bytes of every PNG file. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * GETs a binary resource, used for skin renders.
 *
 * A render service can answer an error status and send the image at the same
 * time. Crafatar does this: it renders the head, sets 500 because one of its
 * own parts failed, and a cache in front of it then holds that status for an
 * hour. The bytes are a correct PNG, so the image is used and marked as
 * degraded. A body that is not a PNG is an error, and raises.
 *
 * @param url Absolute URL to request.
 * @param options Timeout, headers and the upstream name used in errors.
 * @returns The bytes and content type, or null on 404.
 * @throws {UpstreamError} On connection failure, timeout, or an error status
 *   without an image.
 */
export async function fetchBinary(
  url: string,
  options: FetchOptions,
): Promise<BinaryResponse | null> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'image/png', ...options.headers },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (cause) {
    throw new UpstreamError(options.upstream, `${options.upstream} is unreachable`, cause);
  }

  if (response.status === 404) return null;

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const body = Buffer.from(await response.arrayBuffer());

  if (response.ok) {
    return { body, contentType, degraded: false };
  }

  if (body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { body, contentType: 'image/png', degraded: true };
  }

  throw new UpstreamError(options.upstream, `${options.upstream} answered ${response.status}`);
}

async function get(url: string, options: FetchOptions, accept: string): Promise<Response | null> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept, ...options.headers },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (cause) {
    throw new UpstreamError(options.upstream, `${options.upstream} is unreachable`, cause);
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new UpstreamError(options.upstream, `${options.upstream} answered ${response.status}`);
  }

  return response;
}
