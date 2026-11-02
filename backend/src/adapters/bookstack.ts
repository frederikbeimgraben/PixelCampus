import type { Config } from '../config.js';
import type { WikiPage, WikiPageRef, WikiToc } from '../contract/index.js';
import { renderWikiHtml, type WikiHtmlContext } from '../domain/wiki-html.js';
import { TtlCache } from '../lib/cache.js';
import { NotConfiguredError, NotFoundError, UpstreamError } from '../lib/errors.js';
import { nodeGet, type NodeResponse } from '../lib/http-node.js';

/** An image of the wiki, as the proxy serves it. */
export interface WikiImage {
  readonly body: Buffer;
  readonly contentType: string;
}

interface BookStackPageRef {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly draft?: boolean;
}

interface BookStackContent extends BookStackPageRef {
  readonly type: 'chapter' | 'page';
  readonly pages?: readonly BookStackPageRef[];
}

interface BookStackBook {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly contents?: readonly BookStackContent[];
}

interface BookStackPage {
  readonly id: number;
  readonly book_id: number;
  readonly name: string;
  readonly slug: string;
  readonly html: string;
  readonly updated_at?: string | null;
}

/** Where each page sits, built from the contents of the book. */
interface PageIndexEntry {
  readonly id: number;
  readonly chapter: WikiPageRef | null;
}

interface BookSnapshot {
  readonly book: BookStackBook;
  readonly toc: WikiToc;
  readonly index: ReadonlyMap<string, PageIndexEntry>;
}

/** Images keep for a day. BookStack names every upload uniquely. */
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the wiki: one book in BookStack.
 *
 * The token belongs to a bot whose role can read only that book, and every
 * page is still checked against the book before it is shown. Contents and
 * pages are cached for WIKI_CACHE_TTL_SECONDS; the BookStack webhook clears
 * the cache after every change, so an edit shows at once.
 */
export class BookStackAdapter {
  private readonly books = new TtlCache<BookSnapshot>(0);
  private readonly pages = new TtlCache<WikiPage>(0);
  private readonly images = new TtlCache<WikiImage | null>(IMAGE_TTL_MS);
  private readonly ttlMs: number;
  private readonly htmlContext: WikiHtmlContext;

  constructor(private readonly config: Config) {
    this.ttlMs = config.WIKI_CACHE_TTL_SECONDS * 1000;
    this.htmlContext = {
      bookSlug: /^\d+$/.test(config.BOOKSTACK_BOOK) ? '' : config.BOOKSTACK_BOOK,
      bookstackHosts: hostsOf(
        [config.BOOKSTACK_URL, config.BOOKSTACK_PUBLIC_URL],
        config.BOOKSTACK_HOST,
      ),
    };
  }

  get configured(): boolean {
    return this.config.bookstackConfigured;
  }

  /** @returns Chapters and pages of the book; an empty wiki when unconfigured. */
  async toc(): Promise<WikiToc> {
    if (!this.configured) {
      return { configured: false, name: '', editUrl: null, chapters: [], pages: [] };
    }
    return (await this.snapshot()).toc;
  }

  /**
   * @param slug Page slug.
   * @returns The page, sanitized, with its links rewritten.
   * @throws {NotFoundError} If the book has no such page, or the page is in another book.
   */
  async page(slug: string): Promise<WikiPage> {
    if (!this.configured) {
      throw new NotFoundError('The wiki is not configured on this server');
    }

    const snapshot = await this.snapshot();
    const entry = snapshot.index.get(slug);
    if (entry === undefined) {
      throw new NotFoundError(`No wiki page "${slug}"`);
    }

    return this.cached(this.pages, `page:${slug}`, async () => {
      const raw = await this.json<BookStackPage>(`/api/pages/${entry.id}`);
      if (raw === null || raw.book_id !== snapshot.book.id) {
        throw new NotFoundError(`No wiki page "${slug}"`);
      }

      const context = { ...this.htmlContext, bookSlug: snapshot.book.slug };
      return {
        name: raw.name,
        slug: raw.slug,
        html: renderWikiHtml(raw.html, context),
        updatedAt: isoOrNull(raw.updated_at),
        editUrl: this.publicUrl(`/books/${snapshot.book.slug}/page/${raw.slug}`),
        chapter: entry.chapter,
      };
    });
  }

  /**
   * @param path An upload path that passed isWikiImagePath.
   * @returns The image, or null when BookStack has none.
   */
  async image(path: string): Promise<WikiImage | null> {
    if (!this.configured) return null;

    return this.images.get(path, async () => {
      const response = await this.get(`/${path}`);
      if (response.status === 404) return null;
      if (response.status !== 200 || !response.contentType.startsWith('image/')) {
        throw new UpstreamError('BookStack', `BookStack answered ${response.status} for an image`);
      }
      return { body: response.body, contentType: response.contentType };
    });
  }

  /** Forgets the contents and every page, so the next request reads them again. */
  clear(): void {
    this.books.clear();
    this.pages.clear();
  }

  private snapshot(): Promise<BookSnapshot> {
    return this.cached(this.books, 'book', async () => {
      const id = await this.bookId();
      const book = await this.json<BookStackBook>(`/api/books/${id}`);
      if (book === null) {
        throw new UpstreamError('BookStack', 'BookStack has no wiki book');
      }
      return toSnapshot(book, this.publicUrl(`/books/${book.slug}`));
    });
  }

  private async bookId(): Promise<number> {
    const configured = this.config.BOOKSTACK_BOOK;
    if (/^\d+$/.test(configured)) return Number(configured);

    const found = await this.json<{ data?: { id: number; slug: string }[] }>(
      `/api/books?filter[slug]=${encodeURIComponent(configured)}`,
    );
    const book = found?.data?.find((candidate) => candidate.slug === configured);
    if (book === undefined) {
      throw new UpstreamError('BookStack', `BookStack has no book "${configured}"`);
    }
    return book.id;
  }

  private cached<T>(cache: TtlCache<T>, key: string, load: () => Promise<T>): Promise<T> {
    return cache.get(key, load, () => this.ttlMs);
  }

  private async json<T>(path: string): Promise<T | null> {
    const response = await this.get(path);
    if (response.status === 404) return null;
    if (response.status !== 200) {
      throw new UpstreamError('BookStack', `BookStack answered ${response.status}`);
    }
    try {
      return JSON.parse(response.body.toString('utf8')) as T;
    } catch (cause) {
      throw new UpstreamError('BookStack', 'BookStack sent a body that is not JSON', cause);
    }
  }

  private get(path: string): Promise<NodeResponse> {
    if (!this.configured) throw new NotConfiguredError('BookStack');

    return nodeGet(`${trimSlash(this.config.BOOKSTACK_URL)}${path}`, {
      timeoutMs: this.config.UPSTREAM_TIMEOUT_MS,
      host: this.config.BOOKSTACK_HOST,
      upstream: 'BookStack',
      headers: {
        accept: 'application/json, image/*',
        authorization: `Token ${this.config.BOOKSTACK_TOKEN_ID}:${this.config.BOOKSTACK_TOKEN_SECRET}`,
      },
    });
  }

  private publicUrl(path: string): string {
    return `${trimSlash(this.config.BOOKSTACK_PUBLIC_URL)}${path}`;
  }
}

/** Builds the contents and the slug index of a book. Drafts are left out. */
export function toSnapshot(book: BookStackBook, editUrl: string): BookSnapshot {
  const index = new Map<string, PageIndexEntry>();
  const chapters: WikiToc['chapters'] = [];
  const pages: WikiPageRef[] = [];

  for (const item of book.contents ?? []) {
    if (item.type === 'chapter') {
      const chapter = { name: item.name, slug: item.slug };
      const chapterPages: WikiPageRef[] = [];
      for (const page of item.pages ?? []) {
        if (page.draft === true) continue;
        chapterPages.push({ name: page.name, slug: page.slug });
        index.set(page.slug, { id: page.id, chapter });
      }
      chapters.push({ ...chapter, pages: chapterPages });
    } else if (item.draft !== true) {
      pages.push({ name: item.name, slug: item.slug });
      index.set(item.slug, { id: item.id, chapter: null });
    }
  }

  return {
    book,
    index,
    toc: { configured: true, name: book.name, editUrl, chapters, pages },
  };
}

/** @returns "host" or "host:port" of each URL that parses, plus the Host override. */
function hostsOf(urls: readonly string[], hostOverride: string): string[] {
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      hosts.add(new URL(url).host);
    } catch {
      // An empty or partial setting adds nothing.
    }
  }
  if (hostOverride !== '') hosts.add(hostOverride);
  return [...hosts];
}

function isoOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
