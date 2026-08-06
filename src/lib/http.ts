import { request } from 'undici';

import { UpstreamError } from './errors.js';

export interface FetchOptions {
  readonly timeoutMs: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Name used in error messages. */
  readonly upstream: string;
}

/**
 * GETs and decodes a JSON body.
 *
 * Every failure mode collapses into UpstreamError so callers need not tell a
 * refused connection from a timeout from a malformed body.
 *
 * @param url Absolute URL to request.
 * @param options Timeout, headers and the upstream name used in errors.
 * @returns The decoded body, or null on 404.
 * @throws {UpstreamError} On connection failure, timeout, non-2xx or bad JSON.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchOptions): Promise<T | null> {
  let response;

  try {
    response = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...options.headers },
      headersTimeout: options.timeoutMs,
      bodyTimeout: options.timeoutMs,
    });
  } catch (cause) {
    throw new UpstreamError(options.upstream, `${options.upstream} is unreachable`, cause);
  }

  if (response.statusCode === 404) {
    await response.body.dump();
    return null;
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    throw new UpstreamError(options.upstream, `${options.upstream} answered ${response.statusCode}`);
  }

  try {
    return (await response.body.json()) as T;
  } catch (cause) {
    throw new UpstreamError(options.upstream, `${options.upstream} sent a body that is not JSON`, cause);
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
  let response;

  try {
    response = await request(url, {
      method: 'GET',
      headers: options.headers ?? {},
      headersTimeout: options.timeoutMs,
      bodyTimeout: options.timeoutMs,
    });
  } catch (cause) {
    throw new UpstreamError(options.upstream, `${options.upstream} is unreachable`, cause);
  }

  if (response.statusCode === 404) {
    await response.body.dump();
    return null;
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    throw new UpstreamError(options.upstream, `${options.upstream} answered ${response.statusCode}`);
  }

  const contentType = response.headers['content-type'];

  return {
    body: Buffer.from(await response.body.arrayBuffer()),
    contentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
  };
}
