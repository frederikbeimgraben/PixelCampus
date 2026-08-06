/**
 * Parser for the PixelCampus wiki dialect: Markdown-style headers, links, images
 * and emphasis, plus a restricted set of HTML tags.
 *
 * The previous implementation turned the source into an array of single
 * characters and handed a fresh `queue.slice()` to every detector at every
 * position. Copying the remaining input once per character made parsing cost grow
 * with the square of the page length, so a page of a few kilobytes locked the
 * main thread for seconds. This version walks the source with an index and never
 * copies it, so cost grows in step with the length instead.
 *
 * Everything a wiki author can influence -- URLs, styles, tag and attribute names
 * -- is checked against an allow list before it reaches the renderer. See
 * `sanitize.ts` for why that matters.
 */

import { Content, Element, Tag, isAllowedTag, isVoidTag } from './content';
import { sanitizeImageUrl, sanitizeLinkUrl, sanitizeStyle } from './sanitize';

/** Longest source accepted. Anything past this is ignored rather than parsed. */
const MAX_INPUT_LENGTH = 512 * 1024;

/** Deepest element nesting. Guards against source crafted to exhaust the stack. */
const MAX_NESTING_DEPTH = 32;

/** Attributes a wiki author may set, per tag. Anything else is discarded. */
const GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set(['style', 'title']);
const TAG_ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'width', 'height']),
  button: new Set(['target']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

/** Result of an element parse: the node plus where scanning resumes. */
interface Match {
  readonly node: Element;
  readonly next: number;
}

/**
 * Parses wiki source into renderable content.
 *
 * @param source Raw wiki markup.
 * @returns The parsed node list; an empty list when the source has no content.
 */
export function parseWiki(source: string): Content[] {
  const bounded = source.length > MAX_INPUT_LENGTH ? source.slice(0, MAX_INPUT_LENGTH) : source;
  return parseNodes(bounded, 0);
}

/** Parses a run of source at the given nesting depth. */
function parseNodes(source: string, depth: number): Content[] {
  const nodes: Content[] = [];
  let text = '';
  let pos = 0;

  const flushText = (): void => {
    // Whitespace-only runs are dropped, so that layout whitespace in the source
    // does not become stray text nodes between elements.
    if (text.trim() !== '') {
      nodes.push(text);
    }
    text = '';
  };

  while (pos < source.length) {
    const char = source[pos];

    // A backslash makes the next character literal.
    if (char === '\\' && pos + 1 < source.length) {
      text += source[pos + 1];
      pos += 2;
      continue;
    }

    const match = matchElement(source, pos, depth);
    if (match !== null) {
      flushText();
      nodes.push(match.node);
      pos = match.next;
      continue;
    }

    text += char;
    pos++;
  }

  flushText();
  return nodes;
}

/**
 * Tries every element form that can start at `pos`.
 *
 * The switch rejects ordinary characters in constant time, so the scan stays
 * linear even though several forms share a starting character.
 */
function matchElement(source: string, pos: number, depth: number): Match | null {
  if (depth >= MAX_NESTING_DEPTH) {
    return null;
  }

  switch (source[pos]) {
    case '<':
      return matchTag(source, pos, depth);
    case '#':
      return matchHeader(source, pos, depth);
    case '!':
      return matchImage(source, pos);
    case '[':
      return matchLink(source, pos, depth);
    case '*':
      return matchEmphasis(source, pos, depth);
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Markdown-style forms                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Matches `# Heading` through `###### Heading`.
 *
 * Headers are recognised only at the start of a line. The old parser accepted a
 * `#` anywhere, so a hash in the middle of a sentence silently swallowed the rest
 * of the line into a heading.
 */
function matchHeader(source: string, pos: number, depth: number): Match | null {
  const atLineStart = pos === 0 || source[pos - 1] === '\n';
  if (!atLineStart) return null;

  let cursor = pos;
  while (source[cursor] === '#') cursor++;

  const level = Math.min(cursor - pos, 6);
  while (source[cursor] === ' ') cursor++;

  let lineEnd = source.indexOf('\n', cursor);
  if (lineEnd === -1) lineEnd = source.length;

  const heading = source.slice(cursor, lineEnd);
  if (heading.trim() === '') return null;

  return {
    node: {
      tag: `h${level}` as Tag,
      content: parseNodes(heading, depth + 1),
      properties: {},
    },
    next: Math.min(lineEnd + 1, source.length),
  };
}

/** Matches `![alt](src)`. */
function matchImage(source: string, pos: number): Match | null {
  if (source[pos + 1] !== '[') return null;

  const alt = matchDelimited(source, pos + 1, '[', ']');
  if (alt === null) return null;

  const target = matchDelimited(source, alt.end, '(', ')');
  if (target === null) return null;

  const src = sanitizeImageUrl(target.inner);
  if (src === null) {
    // Unsafe source: keep the caption, drop the image.
    return { node: textSpan(alt.inner), next: target.end };
  }

  return {
    node: { tag: 'img', content: [], properties: { src, alt: alt.inner } },
    next: target.end,
  };
}

/** Matches `[text](href)`. */
function matchLink(source: string, pos: number, depth: number): Match | null {
  const label = matchDelimited(source, pos, '[', ']');
  if (label === null) return null;

  const target = matchDelimited(source, label.end, '(', ')');
  if (target === null) return null;

  const href = sanitizeLinkUrl(target.inner);
  if (href === null) {
    // Unsafe target, for example `javascript:`: render the label as plain text.
    return { node: textSpan(label.inner), next: target.end };
  }

  return {
    node: {
      tag: 'a',
      content: parseNodes(label.inner, depth + 1),
      properties: { href },
    },
    next: target.end,
  };
}

/** Matches `*italic*`, `**bold**` and `***bold italic***`. */
function matchEmphasis(source: string, pos: number, depth: number): Match | null {
  let cursor = pos;
  while (source[cursor] === '*') cursor++;

  const markerLength = cursor - pos;
  const marker = '*'.repeat(markerLength);
  const contentStart = cursor;

  const closing = source.indexOf(marker, contentStart);
  if (closing === -1 || closing === contentStart) return null;

  // Emphasis does not span lines, matching the original behaviour.
  const lineEnd = source.indexOf('\n', contentStart);
  if (lineEnd !== -1 && lineEnd < closing) return null;

  return {
    node: {
      tag: 'span',
      content: parseNodes(source.slice(contentStart, closing), depth + 1),
      properties: { style: `font-family: ${emphasisFont(markerLength)};` },
    },
    next: closing + markerLength,
  };
}

function emphasisFont(markerLength: number): string {
  if (markerLength === 1) return 'Minecraft Italic';
  if (markerLength === 2) return 'Minecraft Bold';
  return 'Minecraft Bold Italic';
}

/* -------------------------------------------------------------------------- */
/* Tag form                                                                    */
/* -------------------------------------------------------------------------- */

/** An opening tag that has been read but not yet validated. */
interface OpeningTag {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** Index just past the closing `>`. */
  readonly end: number;
  readonly selfClosing: boolean;
}

/** Matches `<tag ...>...</tag>` and `<tag ... />`. */
function matchTag(source: string, pos: number, depth: number): Match | null {
  const opening = readOpeningTag(source, pos);
  if (opening === null) return null;

  const { name, selfClosing, end } = opening;

  // Unknown tags are unwrapped rather than reported: the author's text survives
  // and no unexpected element reaches the DOM.
  const tag: Tag | null = isAllowedTag(name) ? name : null;

  if (selfClosing || isVoidTag(name)) {
    return {
      node: {
        tag: tag ?? 'span',
        content: [],
        properties: tag === null ? {} : sanitizeAttributes(tag, opening.attributes),
      },
      next: end,
    };
  }

  const closing = findMatchingClose(source, end, name);
  if (closing === null) {
    // No closing tag: treat the `<` as ordinary text.
    return null;
  }

  return {
    node: {
      tag: tag ?? 'span',
      content: parseNodes(closing.inner, depth + 1),
      properties: tag === null ? {} : sanitizeAttributes(tag, opening.attributes),
    },
    next: closing.end,
  };
}

/** Reads an opening tag starting at `pos`, or returns null when there is none. */
function readOpeningTag(source: string, pos: number): OpeningTag | null {
  if (source[pos] !== '<' || source[pos + 1] === '/') return null;

  let cursor = pos + 1;
  const nameStart = cursor;
  while (cursor < source.length && isNameChar(source[cursor])) cursor++;

  const name = source.slice(nameStart, cursor).toLowerCase();
  if (name === '') return null;

  // Find the `>` that ends the tag, ignoring any inside quoted attribute values.
  let quote: string | null = null;
  let close = -1;
  for (let i = cursor; i < source.length; i++) {
    const char = source[i];

    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      close = i;
      break;
    }
  }
  if (close === -1) return null;

  const selfClosing = source[close - 1] === '/';
  const attributeSource = source.slice(cursor, selfClosing ? close - 1 : close);

  return {
    name,
    attributes: readAttributes(attributeSource),
    end: close + 1,
    selfClosing,
  };
}

/** Reads `key="value"` pairs out of the text between the tag name and the `>`. */
function readAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const [, key, doubleQuoted, singleQuoted] = match;
    attributes[key.toLowerCase()] = doubleQuoted ?? singleQuoted ?? '';
  }

  return attributes;
}

/**
 * Keeps only the attributes the tag is allowed to carry, and runs each through
 * the sanitiser that fits it.
 */
function sanitizeAttributes(
  tag: Tag,
  attributes: Readonly<Record<string, string>>,
): Record<string, string> {
  const allowed = TAG_ATTRIBUTES[tag];
  const safe: Record<string, string> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!GLOBAL_ATTRIBUTES.has(key) && allowed?.has(key) !== true) {
      continue;
    }

    if (key === 'style') {
      const style = sanitizeStyle(value);
      if (style !== '') safe['style'] = style;
      continue;
    }

    if (key === 'href' || key === 'target') {
      const url = sanitizeLinkUrl(value);
      if (url !== null) safe[key] = url;
      continue;
    }

    if (key === 'src') {
      const url = sanitizeImageUrl(value);
      if (url !== null) safe[key] = url;
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

/**
 * Finds the `</name>` that closes a tag opened before `from`, skipping over
 * nested tags of the same name.
 */
function findMatchingClose(
  source: string,
  from: number,
  name: string,
): { inner: string; end: number } | null {
  let depth = 1;
  let cursor = from;

  while (cursor < source.length) {
    const next = source.indexOf('<', cursor);
    if (next === -1) return null;

    if (source.startsWith('</', next)) {
      const closing = readClosingTagName(source, next);
      if (closing !== null && closing.name === name) {
        depth--;
        if (depth === 0) {
          return { inner: source.slice(from, next), end: closing.end };
        }
        cursor = closing.end;
        continue;
      }
      cursor = next + 2;
      continue;
    }

    const opening = readOpeningTag(source, next);
    if (opening !== null && opening.name === name) {
      if (!opening.selfClosing && !isVoidTag(name)) depth++;
      cursor = opening.end;
      continue;
    }

    cursor = next + 1;
  }

  return null;
}

/** Reads a `</name>` closing tag at `pos`. */
function readClosingTagName(source: string, pos: number): { name: string; end: number } | null {
  let cursor = pos + 2;
  const start = cursor;
  while (cursor < source.length && isNameChar(source[cursor])) cursor++;

  const name = source.slice(start, cursor).toLowerCase();
  if (name === '') return null;

  const close = source.indexOf('>', cursor);
  if (close === -1) return null;

  return { name, end: close + 1 };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reads a `open ... close` run starting at `pos`, honouring nesting and
 * backslash escapes.
 *
 * @returns The text between the delimiters and the index just past `close`.
 */
function matchDelimited(
  source: string,
  pos: number,
  open: string,
  close: string,
): { inner: string; end: number } | null {
  if (source[pos] !== open) return null;

  let depth = 0;
  for (let i = pos; i < source.length; i++) {
    const char = source[i];

    if (char === '\\') {
      i++;
      continue;
    }
    if (char === open) {
      depth++;
      continue;
    }
    if (char === close) {
      depth--;
      if (depth === 0) {
        return { inner: source.slice(pos + 1, i), end: i + 1 };
      }
    }
  }

  return null;
}

/** Wraps literal text in a span, used when an element is rejected. */
function textSpan(text: string): Element {
  return { tag: 'span', content: [text], properties: {} };
}

function isNameChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '-' ||
    char === '_'
  );
}

export type { Content, Element } from './content';
