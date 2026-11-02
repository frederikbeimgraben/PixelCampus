/** What a click on a link in a wiki page does. */
export type WikiLinkAction =
  | { readonly kind: 'route'; readonly url: string }
  | { readonly kind: 'anchor'; readonly id: string }
  | { readonly kind: 'default' };

/**
 * Decides how a click on a link inside a wiki page is handled.
 *
 * The page HTML is inserted as it is, so its links are plain anchors. A link to
 * another wiki page would reload the whole site, and a bookmark (#id) would
 * resolve against the base href and leave the page. Both are handled in the
 * app instead. Every other link keeps the browser's behaviour.
 *
 * @param href The href attribute as written, not the resolved URL.
 * @returns The action.
 */
export function wikiLinkAction(href: string | null): WikiLinkAction {
  if (href === null || href === '') return { kind: 'default' };

  if (href.startsWith('#') && href.length > 1) {
    return { kind: 'anchor', id: decodeURIComponent(href.slice(1)) };
  }

  if (/^\/wiki(\/[a-z0-9-]+)?(#[^\s]*)?$/.test(href)) {
    return { kind: 'route', url: href };
  }

  return { kind: 'default' };
}
