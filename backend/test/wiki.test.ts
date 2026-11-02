import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BookStackAdapter, toSnapshot } from '../src/adapters/bookstack.js';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { isWikiImagePath, renderWikiHtml } from '../src/domain/wiki-html.js';
import { sameSecret } from '../src/routes/wiki.js';

const context = {
  bookSlug: 'pixelcampus-wiki',
  bookstackHosts: ['wiki.example.org', '10.0.0.6:8080'],
};

describe('renderWikiHtml', () => {
  it('strips scripts, event handlers and javascript: links', () => {
    const html = renderWikiHtml(
      '<p onclick="x()">Hi<script>alert(1)</script></p>' +
        '<a href="javascript:alert(1)">bad</a>' +
        '<img src="/uploads/images/gallery/2026-11/a.png" onerror="alert(1)">' +
        '<iframe src="https://evil.example"></iframe>',
      context,
    );

    expect(html).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
    expect(html).toContain('<p>Hi</p>');
  });

  it('turns links to pages of the book into site links, with the anchor', () => {
    const html = renderWikiHtml(
      '<a href="https://wiki.example.org/books/pixelcampus-wiki/page/erste-schritte#bkmrk-java">a</a>' +
        '<a href="/books/pixelcampus-wiki/page/regeln">b</a>' +
        '<a href="#bkmrk-top">c</a>',
      context,
    );

    expect(html).toContain('<a href="/wiki/erste-schritte#bkmrk-java">a</a>');
    expect(html).toContain('<a href="/wiki/regeln">b</a>');
    expect(html).toContain('<a href="#bkmrk-top">c</a>');
  });

  it('keeps links to other books and other sites external', () => {
    const html = renderWikiHtml(
      '<a href="https://wiki.example.org/books/other-book/page/x">a</a>' +
        '<a href="https://minecraft.net/">b</a>',
      context,
    );

    expect(html).toContain(
      '<a href="https://wiki.example.org/books/other-book/page/x" target="_blank" rel="noopener noreferrer">a</a>',
    );
    expect(html).toContain(
      '<a href="https://minecraft.net/" target="_blank" rel="noopener noreferrer">b</a>',
    );
  });

  it('sends BookStack images through the proxy and drops foreign images', () => {
    const html = renderWikiHtml(
      '<a href="http://10.0.0.6:8080/uploads/images/gallery/2026-11/full.png">' +
        '<img src="https://wiki.example.org/uploads/images/gallery/2026-11/scaled-1680-/full.png" alt="Karte"></a>' +
        '<img src="https://tracker.example/pixel.gif">',
      context,
    );

    expect(html).toContain('href="/api/v1/wiki/images/uploads/images/gallery/2026-11/full.png"');
    expect(html).toContain(
      '<img src="/api/v1/wiki/images/uploads/images/gallery/2026-11/scaled-1680-/full.png" alt="Karte" />',
    );
    expect(html).not.toContain('tracker.example');
  });

  it('keeps only the callout classes of a paragraph', () => {
    const html = renderWikiHtml(
      '<p class="callout warning evil" id="bkmrk-x">Achtung</p>',
      context,
    );
    expect(html).toBe('<p class="callout warning" id="bkmrk-x">Achtung</p>');
  });
});

describe('isWikiImagePath', () => {
  it('accepts image uploads only', () => {
    expect(isWikiImagePath('uploads/images/gallery/2026-11/a.png')).toBe(true);
    expect(isWikiImagePath('uploads/images/../../.env')).toBe(false);
    expect(isWikiImagePath('uploads/files/2026-11/a.pdf')).toBe(false);
    expect(isWikiImagePath('uploads/images/gallery/a.php')).toBe(false);
  });
});

describe('toSnapshot', () => {
  it('maps chapters and loose pages and leaves drafts out', () => {
    const snapshot = toSnapshot(
      {
        id: 69,
        name: 'PixelCampus-Wiki',
        slug: 'pixelcampus-wiki',
        contents: [
          { type: 'page', id: 1, name: 'Start', slug: 'start' },
          {
            type: 'chapter',
            id: 2,
            name: 'Server',
            slug: 'server',
            pages: [
              { id: 3, name: 'Regeln', slug: 'regeln' },
              { id: 4, name: 'Entwurf', slug: 'entwurf', draft: true },
            ],
          },
        ],
      },
      'https://wiki.example.org/books/pixelcampus-wiki',
    );

    expect(snapshot.toc).toEqual({
      configured: true,
      name: 'PixelCampus-Wiki',
      editUrl: 'https://wiki.example.org/books/pixelcampus-wiki',
      chapters: [{ name: 'Server', slug: 'server', pages: [{ name: 'Regeln', slug: 'regeln' }] }],
      pages: [{ name: 'Start', slug: 'start' }],
    });
    expect(snapshot.index.get('regeln')).toEqual({
      id: 3,
      chapter: { name: 'Server', slug: 'server' },
    });
    expect(snapshot.index.has('entwurf')).toBe(false);
  });
});

describe('sameSecret', () => {
  it('compares secrets of any length', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abcd')).toBe(false);
    expect(sameSecret('', 'abc')).toBe(false);
  });
});

/** A stand-in for BookStack: the book, two pages, one of them in another book. */
function fakeBookStack(seen: IncomingMessage[]): Server {
  return createServer((request, response) => {
    seen.push(request);
    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    switch (request.url) {
      case '/api/books?filter[slug]=pixelcampus-wiki':
        return send(200, { data: [{ id: 69, slug: 'pixelcampus-wiki' }] });
      case '/api/books/69':
        return send(200, {
          id: 69,
          name: 'PixelCampus-Wiki',
          slug: 'pixelcampus-wiki',
          contents: [
            { type: 'page', id: 1, name: 'Start', slug: 'start' },
            { type: 'page', id: 2, name: 'Fremd', slug: 'fremd' },
          ],
        });
      case '/api/pages/1':
        return send(200, {
          id: 1,
          book_id: 69,
          name: 'Start',
          slug: 'start',
          html: '<h1 id="bkmrk-a">Willkommen</h1><script>x()</script>',
          updated_at: '2026-11-02T00:00:00.000000Z',
        });
      case '/api/pages/2':
        return send(200, {
          id: 2,
          book_id: 1,
          name: 'Fremd',
          slug: 'fremd',
          html: '<p>geheim</p>',
        });
      default:
        return send(404, { error: 'not found' });
    }
  });
}

describe('BookStackAdapter', () => {
  const seen: IncomingMessage[] = [];
  let server: Server;
  let config: Config;

  beforeAll(async () => {
    server = fakeBookStack(seen);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    config = loadConfig({
      BOOKSTACK_URL: `http://127.0.0.1:${port}`,
      BOOKSTACK_HOST: 'wiki.example.org',
      BOOKSTACK_PUBLIC_URL: 'https://wiki.example.org',
      BOOKSTACK_TOKEN_ID: 'id',
      BOOKSTACK_TOKEN_SECRET: 'secret',
    } as NodeJS.ProcessEnv);
  });

  afterAll(() => {
    server.close();
  });

  it('reads the contents with the token and the Host override', async () => {
    const toc = await new BookStackAdapter(config).toc();

    expect(toc.pages.map((page) => page.slug)).toEqual(['start', 'fremd']);
    expect(seen.at(-1)?.headers['authorization']).toBe('Token id:secret');
    expect(seen.at(-1)?.headers['host']).toBe('wiki.example.org');
  });

  it('serves a page of the book, sanitized, with its edit link', async () => {
    const page = await new BookStackAdapter(config).page('start');

    expect(page).toEqual({
      name: 'Start',
      slug: 'start',
      html: '<h1 id="bkmrk-a">Willkommen</h1>',
      updatedAt: '2026-11-02T00:00:00.000Z',
      editUrl: 'https://wiki.example.org/books/pixelcampus-wiki/page/start',
      chapter: null,
    });
  });

  it('refuses a page that belongs to another book', async () => {
    await expect(new BookStackAdapter(config).page('fremd')).rejects.toThrow(/No wiki page/);
  });

  it('refuses a slug the book does not have', async () => {
    await expect(new BookStackAdapter(config).page('missing')).rejects.toThrow(/No wiki page/);
  });

  it('shows an empty wiki when BookStack is not configured', async () => {
    const toc = await new BookStackAdapter(loadConfig({} as NodeJS.ProcessEnv)).toc();
    expect(toc).toEqual({ configured: false, name: '', editUrl: null, chapters: [], pages: [] });
  });
});

describe('wiki routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(
      loadConfig({ LOG_LEVEL: 'fatal', BOOKSTACK_WEBHOOK_SECRET: 's3cret' } as NodeJS.ProcessEnv),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses the hook with a wrong or missing secret', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/wiki/hook?secret=nope' })).statusCode,
    ).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/wiki/hook' })).statusCode).toBe(403);
  });

  it('accepts the hook with the secret', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/wiki/hook?secret=s3cret' });
    expect(response.statusCode).toBe(204);
  });

  it('has no hook when no secret is configured', async () => {
    const bare = await buildApp(loadConfig({ LOG_LEVEL: 'fatal' } as NodeJS.ProcessEnv));
    expect(
      (await bare.inject({ method: 'POST', url: '/api/v1/wiki/hook?secret=' })).statusCode,
    ).toBe(404);
    await bare.close();
  });

  it('refuses image paths outside the uploads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/wiki/images/uploads/files/x.pdf',
    });
    expect(response.statusCode).toBe(404);
  });

  it('answers the contents of an unconfigured wiki as empty', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/wiki' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ configured: false, chapters: [], pages: [] });
  });

  it('404s a page of an unconfigured wiki', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/wiki/pages/start' });
    expect(response.statusCode).toBe(404);
  });
});
