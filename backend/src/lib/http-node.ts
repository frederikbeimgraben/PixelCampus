import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { UpstreamError } from './errors.js';

export interface NodeRequestOptions {
  readonly timeoutMs: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Sent as the Host header instead of the host of the URL. Empty leaves it alone. */
  readonly host?: string;
  /** Larger bodies are an error, so one huge upload cannot fill the memory. */
  readonly maxBytes?: number;
  /** Name used in error messages. */
  readonly upstream: string;
}

export interface NodeResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: Buffer;
}

/** Bodies above this size are refused unless the caller sets its own limit. */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/*
 * This module uses node:http, not the global fetch. fetch drops a Host header
 * that the caller sets, and an internal address can need the public name to
 * pick its site. The request asks for no compression, so the body arrives as
 * it is.
 */

/**
 * GETs a URL and returns the status, the content type and the whole body.
 *
 * Every transport failure becomes an UpstreamError. The status is returned as
 * it is; the caller decides what a 404 or a 500 means.
 *
 * @param url Absolute http or https URL.
 * @param options Timeout, headers, Host override, size limit and the upstream name.
 * @returns The response.
 * @throws {UpstreamError} On connection failure, timeout or an oversized body.
 */
export function nodeGet(url: string, options: NodeRequestOptions): Promise<NodeResponse> {
  const target = new URL(url);
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const headers: Record<string, string> = { ...options.headers };
  if (options.host !== undefined && options.host !== '') {
    headers['host'] = options.host;
  }

  return new Promise((resolve, reject) => {
    const req = request(target, { method: 'GET', headers, timeout: options.timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;

      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          reject(new UpstreamError(options.upstream, `${options.upstream} sent too much`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: res.headers['content-type'] ?? 'application/octet-stream',
          body: Buffer.concat(chunks),
        });
      });
      res.on('error', (cause) => {
        reject(new UpstreamError(options.upstream, `${options.upstream} broke off`, cause));
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (cause) => {
      reject(new UpstreamError(options.upstream, `${options.upstream} is unreachable`, cause));
    });
    req.end();
  });
}
