/** Element vocabulary the wiki renderer understands. */

/** Plain HTML tags a wiki author may use. */
export const HTML_TAGS = [
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'br',
  'img',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'li',
  'code',
  'blockquote',
  'hr',
] as const;

/** Tags that render as a Minecraft GUI widget instead of a plain element. */
export const WIDGET_TAGS = ['button', 'card'] as const;

export type HtmlTag = (typeof HTML_TAGS)[number];
export type WidgetTag = (typeof WIDGET_TAGS)[number];
export type Tag = HtmlTag | WidgetTag;

const ALLOWED_TAGS: ReadonlySet<string> = new Set<string>([...HTML_TAGS, ...WIDGET_TAGS]);

/** True when `name` is a tag wiki authors may use. */
export function isAllowedTag(name: string): name is Tag {
  return ALLOWED_TAGS.has(name);
}

/** Tags that never have children. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img']);

/** True when `name` is a tag that cannot contain content. */
export function isVoidTag(name: string): boolean {
  return VOID_TAGS.has(name);
}

/** A parsed element. */
export interface Element {
  readonly tag: Tag;
  readonly content: readonly Content[];
  /** Already sanitised; safe to bind straight into the template. */
  readonly properties: Readonly<Record<string, string>>;
}

/** A node of parsed wiki content: either literal text or an element. */
export type Content = string | Element;

/** True when `item` is literal text rather than an element. */
export function isText(item: Content): item is string {
  return typeof item === 'string';
}
