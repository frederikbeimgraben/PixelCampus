/**
 * Sanitisers for values that come out of the wiki source.
 *
 * Wiki text is authored elsewhere and served by the API, so it is untrusted input.
 * Angular escapes interpolated text and checks URLs bound to `href`/`src`, but it
 * stopped sanitising `[style]` in v10. A `style` attribute is therefore the one
 * channel through which wiki source could reach the page unchecked, which is
 * enough to exfiltrate data with `background: url(...)` or to cover the page with
 * a positioned overlay. Both are closed here.
 */

/** CSS properties wiki authors may set. Anything else is dropped. */
const ALLOWED_CSS_PROPERTIES: ReadonlySet<string> = new Set([
  'align-items',
  'align-self',
  'background-color',
  'border',
  'border-bottom',
  'border-color',
  'border-left',
  'border-radius',
  'border-right',
  'border-style',
  'border-top',
  'border-width',
  'color',
  'column-gap',
  'display',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'justify-content',
  'justify-self',
  'letter-spacing',
  'line-height',
  'list-style',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'overflow',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'row-gap',
  'text-align',
  'text-decoration',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
]);

/*
 * `position`, `z-index`, `transform`, `filter`, `content` and the animation
 * properties are deliberately absent: they let content lift itself out of its
 * container and cover unrelated parts of the page, which turns a wiki edit into
 * a clickjacking primitive.
 */

/** Constructs that must never appear in a value, whatever the property is. */
const FORBIDDEN_VALUE_PATTERN = /url\s*\(|expression\s*\(|javascript:|@import|\\|\/\*|<|>/i;

/** URL schemes a wiki link may use. */
const SAFE_URL_SCHEME = /^(https?:|mailto:)/i;

/**
 * Filters a CSS declaration list down to the allowed properties.
 *
 * @param style Raw `style` attribute value from the wiki source.
 * @returns A declaration list containing only allowed, safe declarations.
 */
export function sanitizeStyle(style: string): string {
  const safe: string[] = [];

  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();

    if (property === '' || value === '') continue;
    if (!ALLOWED_CSS_PROPERTIES.has(property)) continue;
    if (FORBIDDEN_VALUE_PATTERN.test(value)) continue;
    if (value.includes('!important')) continue;

    safe.push(`${property}: ${value}`);
  }

  return safe.length === 0 ? '' : `${safe.join('; ')};`;
}

/**
 * Checks a link target from the wiki source.
 *
 * @param url Raw href from the wiki source.
 * @returns The URL when it is safe to navigate to, otherwise `null`.
 */
export function sanitizeLinkUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;

  // Same-document and same-origin targets carry no scheme and are always fine.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;

  // Anything with a scheme must use one of the safe ones. This rejects
  // `javascript:`, `data:` and `vbscript:`.
  if (trimmed.includes(':')) {
    return SAFE_URL_SCHEME.test(trimmed) ? trimmed : null;
  }

  return trimmed;
}

/**
 * Checks an image source from the wiki source.
 *
 * @param url Raw src from the wiki source.
 * @returns The URL when it is safe to load, otherwise `null`.
 */
export function sanitizeImageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('/')) return trimmed;

  if (trimmed.includes(':')) {
    return /^https?:/i.test(trimmed) ? trimmed : null;
  }

  return trimmed;
}
