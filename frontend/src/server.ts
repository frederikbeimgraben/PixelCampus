import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

/**
 * The server-rendering entry point.
 *
 * In production nginx serves everything in browser/ from disk. It sends only
 * document requests here. The static handler below is a fallback for running
 * this process on its own.
 */

/** Header the proxy in front of this process puts its per-request nonce in. */
const CSP_NONCE_HEADER = 'x-csp-nonce';

/** Inline elements, which a nonce policy blocks unless they carry the nonce. */
const INLINE_SCRIPT = /<script(?![^>]*\b(?:nonce|src)=)/gi;
const INLINE_STYLE = /<style(?![^>]*\bnonce=)/gi;
const APP_ROOT = /<app-root(?![^>]*\bngCspNonce=)/i;

/**
 * Stamps the request's nonce onto the inline blocks the render emitted.
 *
 * Angular stamps the styles it injects and its hydration script. It does not
 * stamp the event-dispatch contract it writes for event replay, or the
 * critical CSS in the document head. The policy blocks both. Without the
 * dispatcher, a click made before the bundle loads is lost.
 *
 * Editing the markup as text is safe here, and would not be in general. This
 * process produced the document a moment ago, from templates in this
 * repository. No part of it came from a request.
 *
 * ngCspNonce on the root element tells the browser half of the app the nonce.
 * It needs the nonce for the styles of anything loaded after hydration.
 *
 * @param html The rendered document.
 * @param nonce The nonce for this request.
 * @returns The document with every inline block admitted by name.
 */
export function applyNonce(html: string, nonce: string): string {
  return html
    .replace(INLINE_SCRIPT, `<script nonce="${nonce}"`)
    .replace(INLINE_STYLE, `<style nonce="${nonce}"`)
    .replace(APP_ROOT, `<app-root ngCspNonce="${nonce}"`);
}

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Hashed file names, so the year is safe. index is off: an unhashed index.html
// would otherwise be returned instead of a rendered page.
app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

app.use((request, response, next) => {
  angularApp
    .handle(request)
    .then(async (rendered) => {
      if (!rendered) return next();

      const nonce = request.headers[CSP_NONCE_HEADER];
      if (typeof nonce !== 'string' || nonce === '') {
        return writeResponseToNodeResponse(rendered, response);
      }

      const headers = new Headers(rendered.headers);
      // A nonce may be used once. A stored copy replayed later would carry one
      // the policy no longer names, so the page must not be kept.
      headers.set('cache-control', 'no-store');

      const stamped = new Response(applyNonce(await rendered.text(), nonce), {
        status: rendered.status,
        headers,
      });

      return writeResponseToNodeResponse(stamped, response);
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 4000);
  // Loopback by default: nginx is in front of this.
  const host = process.env['HOST'] ?? '127.0.0.1';

  app.listen(port, host, (error?: Error) => {
    if (error) throw error;
    console.warn(`PixelCampus rendering on http://${host}:${port}`);
  });
}

/** Used by the CLI dev server and during the build. */
export const reqHandler = createNodeRequestHandler(app);
