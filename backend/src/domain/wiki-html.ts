import sanitizeHtml from 'sanitize-html';

/** Path under which the API serves the images of the wiki. */
export const WIKI_IMAGE_ROUTE = '/api/v1/wiki/images/';

/**
 * Upload paths the image proxy serves: BookStack's image uploads only, with an
 * image extension and no step out of the directory. Everything else on the
 * BookStack host stays out of reach of the proxy.
 */
const IMAGE_PATH =
  /^uploads\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp)$/i;

/** @returns Whether the proxy may fetch this upload path. */
export function isWikiImagePath(path: string): boolean {
  return IMAGE_PATH.test(path) && !path.split('/').includes('..');
}

export interface WikiHtmlContext {
  /** Slug of the wiki book. Links into other books stay external. */
  readonly bookSlug: string;
  /**
   * Hosts that a BookStack link can carry, in the form "host" or "host:port":
   * the public name and the internal address. Links to them are rewritten.
   */
  readonly bookstackHosts: readonly string[];
}

/** Callout classes of BookStack's editor, the only classes a paragraph keeps. */
const CALLOUT_CLASSES = ['callout', 'info', 'success', 'warning', 'danger'];

/**
 * Turns a BookStack page body into HTML the site can show.
 *
 * The body is untrusted: anyone who may edit the book writes it. Only an
 * allowlist of tags and attributes survives, so a script, an event handler or
 * a javascript: link never reaches a visitor. Links to pages of the same book
 * become site links, /wiki/<slug>, and images become requests to the image
 * proxy of this API, because the BookStack host sits behind a login gate and
 * the site's content policy allows images from its own origin only. An image
 * from anywhere else is dropped.
 *
 * @param html The page HTML from BookStack.
 * @param context The book and the hosts that identify BookStack links.
 * @returns Sanitized HTML.
 */
export function renderWikiHtml(html: string, context: WikiHtmlContext): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'blockquote',
      'pre',
      'code',
      'kbd',
      'samp',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'colgroup',
      'col',
      'a',
      'img',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'ins',
      'mark',
      'sub',
      'sup',
      'small',
      'details',
      'summary',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      ol: ['start'],
      p: ['class', 'id'],
      code: ['class'],
      details: ['open'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
      li: ['id'],
      blockquote: ['id'],
    },
    allowedClasses: {
      p: CALLOUT_CLASSES,
      code: ['language-*'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: [] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: rewriteLink(attribs, context) }),
      img: (tagName, attribs) => ({ tagName, attribs: rewriteImage(attribs, context) }),
    },
    // An image whose source was not a BookStack upload has no src left.
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs['src'],
  });
}

function rewriteLink(
  attribs: Record<string, string>,
  context: WikiHtmlContext,
): Record<string, string> {
  const href = attribs['href'];
  const { href: _old, target: _target, rel: _rel, ...rest } = attribs;
  if (href === undefined || href === '') return rest;

  // A bookmark on the same page.
  if (href.startsWith('#')) return { ...rest, href };

  const internal = bookstackPath(href, context);
  if (internal !== null) {
    const page = pagePath(internal, context.bookSlug);
    if (page !== null) return { ...rest, href: page };

    // A link to a full-size image, which BookStack puts around an image.
    const image = imageProxyPath(internal);
    if (image !== null) return { ...rest, href: image };
  }

  return { ...rest, href, target: '_blank', rel: 'noopener noreferrer' };
}

function rewriteImage(
  attribs: Record<string, string>,
  context: WikiHtmlContext,
): Record<string, string> {
  const { src, ...rest } = attribs;
  if (src === undefined) return rest;

  const internal = bookstackPath(src, context);
  const image = internal === null ? null : imageProxyPath(internal);
  return image === null ? rest : { src: image, ...rest };
}

/**
 * @returns The path and fragment of a URL that points at BookStack, without
 *   the leading slash, or null for a URL that points elsewhere. A relative
 *   path counts as BookStack, because BookStack wrote it.
 */
function bookstackPath(url: string, context: WikiHtmlContext): string | null {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url.slice(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!context.bookstackHosts.includes(parsed.host)) return null;

  return `${parsed.pathname.slice(1)}${parsed.hash}`;
}

/** @returns /wiki/<slug> with its fragment for a page of the book, or null. */
function pagePath(path: string, bookSlug: string): string | null {
  const [beforeHash = '', hash] = path.split('#', 2);
  const match = /^books\/([^/]+)\/page\/([a-z0-9-]+)\/?$/.exec(beforeHash);
  if (match === null || match[1] !== bookSlug) return null;

  return `/wiki/${match[2]}${hash === undefined ? '' : `#${hash}`}`;
}

function imageProxyPath(path: string): string | null {
  const [beforeHash = ''] = path.split('#', 1);
  return isWikiImagePath(beforeHash) ? `${WIKI_IMAGE_ROUTE}${beforeHash}` : null;
}
