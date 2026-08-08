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
}

/**
 * GETs a binary resource, used for skin renders.
 *
 * @param url Absolute URL to request.
 * @param options Timeout, headers and the upstream name used in errors.
 * @returns The bytes and content type, or null on 404.
 * @throws {UpstreamError} On connection failure, timeout or non-2xx.
 */
export async function fetchBinary(
  url: string,
  options: FetchOptions,
): Promise<BinaryResponse | null> {
  const response = await get(url, options, 'image/png');
  if (response === null) return null;

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
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
