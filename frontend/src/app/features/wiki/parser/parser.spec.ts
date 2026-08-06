import { describe, expect, it } from 'vitest';

import { Content, Element, isText } from './content';
import { parseWiki } from './parser';

/** Narrows a node to an element, failing the test when it is text. */
function asElement(node: Content): Element {
  if (isText(node)) {
    throw new Error(`expected an element, got text: ${node}`);
  }
  return node;
}

/** Concatenates every text node in a subtree. */
function textOf(nodes: readonly Content[]): string {
  return nodes
    .map((node) => (isText(node) ? node : textOf(node.content)))
    .join('');
}

describe('parseWiki', () => {
  describe('text', () => {
    it('returns plain text unchanged', () => {
      expect(parseWiki('hello world')).toEqual(['hello world']);
    });

    it('drops whitespace-only nodes', () => {
      expect(parseWiki('   \n  ')).toEqual([]);
    });

    it('treats a backslash as an escape', () => {
      expect(parseWiki('\\*not italic\\*')).toEqual(['*not italic*']);
    });
  });

  describe('headers', () => {
    it('parses levels one through six', () => {
      for (let level = 1; level <= 6; level++) {
        const [node] = parseWiki(`${'#'.repeat(level)} Title`);
        expect(asElement(node).tag).toBe(`h${level}`);
      }
    });

    it('caps deeper runs at level six', () => {
      const [node] = parseWiki('######### Title');
      expect(asElement(node).tag).toBe('h6');
    });

    it('only starts a header at the beginning of a line', () => {
      // The old parser turned this into a heading and swallowed the rest.
      expect(parseWiki('issue #42 was fixed')).toEqual(['issue #42 was fixed']);
    });

    it('ends the header at the newline', () => {
      const nodes = parseWiki('# Title\nbody text');
      expect(asElement(nodes[0]).tag).toBe('h1');
      expect(textOf([nodes[0]])).toBe('Title');
      expect(nodes[1]).toBe('body text');
    });
  });

  describe('emphasis', () => {
    it.each([
      ['*a*', 'Minecraft Italic'],
      ['**a**', 'Minecraft Bold'],
      ['***a***', 'Minecraft Bold Italic'],
    ])('maps %s to %s', (source, font) => {
      const element = asElement(parseWiki(source)[0]);
      expect(element.properties['style']).toContain(font);
    });

    it('does not span lines', () => {
      expect(parseWiki('*unclosed\nnext line')).toEqual(['*unclosed\nnext line']);
    });
  });

  describe('links and images', () => {
    it('parses a link', () => {
      const element = asElement(parseWiki('[docs](https://example.com)')[0]);
      expect(element.tag).toBe('a');
      expect(element.properties['href']).toBe('https://example.com');
      expect(textOf(element.content)).toBe('docs');
    });

    it('parses an image', () => {
      const element = asElement(parseWiki('![a compass](/assets/items/compass_01.png)')[0]);
      expect(element.tag).toBe('img');
      expect(element.properties['src']).toBe('/assets/items/compass_01.png');
      expect(element.properties['alt']).toBe('a compass');
    });

    it('keeps the label but drops a javascript: target', () => {
      const element = asElement(parseWiki('[click](javascript:alert(1))')[0]);
      expect(element.tag).toBe('span');
      expect(element.properties['href']).toBeUndefined();
      expect(textOf(element.content)).toBe('click');
    });

    it('drops a data: image source', () => {
      const element = asElement(parseWiki('![x](data:text/html;base64,PHNjcmlwdD4=)')[0]);
      expect(element.properties['src']).toBeUndefined();
    });
  });

  describe('tags', () => {
    it('parses an allowed tag with content', () => {
      const element = asElement(parseWiki('<div>inner</div>')[0]);
      expect(element.tag).toBe('div');
      expect(element.content).toEqual(['inner']);
    });

    it('handles nesting of the same tag', () => {
      const outer = asElement(parseWiki('<div>a<div>b</div>c</div>')[0]);
      expect(outer.tag).toBe('div');
      expect(textOf(outer.content)).toBe('abc');
    });

    it('parses a self-closing tag', () => {
      const element = asElement(parseWiki('<br />')[0]);
      expect(element.tag).toBe('br');
      expect(element.content).toEqual([]);
    });

    it('unwraps an unknown tag but keeps its text', () => {
      const element = asElement(parseWiki('<script>alert(1)</script>')[0]);
      expect(element.tag).toBe('span');
      expect(textOf(element.content)).toBe('alert(1)');
    });

    it('leaves an unclosed tag as literal text', () => {
      expect(parseWiki('3 < 5 and 6 > 2')).toEqual(['3 < 5 and 6 > 2']);
    });

    it('tolerates a > inside a quoted attribute', () => {
      const element = asElement(parseWiki('<div title="a > b">x</div>')[0]);
      expect(element.properties['title']).toBe('a > b');
    });
  });

  describe('attribute sanitising', () => {
    it('keeps allowed style declarations', () => {
      const element = asElement(parseWiki('<span style="color: red">x</span>')[0]);
      expect(element.properties['style']).toBe('color: red;');
    });

    it('drops url() from a style, which could exfiltrate data', () => {
      const element = asElement(
        parseWiki('<div style="background-color: url(https://evil.test/x)">x</div>')[0],
      );
      expect(element.properties['style']).toBeUndefined();
    });

    it('drops position, which could cover the page', () => {
      const element = asElement(parseWiki('<div style="position: fixed; color: red">x</div>')[0]);
      expect(element.properties['style']).toBe('color: red;');
    });

    it('drops attributes the tag may not carry', () => {
      const element = asElement(parseWiki('<div onclick="alert(1)" id="x">y</div>')[0]);
      expect(element.properties['onclick']).toBeUndefined();
      expect(element.properties['id']).toBeUndefined();
    });

    it('rejects a javascript: href on an anchor tag', () => {
      const element = asElement(parseWiki('<a href="javascript:alert(1)">x</a>')[0]);
      expect(element.properties['href']).toBeUndefined();
    });
  });

  describe('robustness', () => {
    it('stops nesting at the depth limit instead of overflowing the stack', () => {
      const source = '<div>'.repeat(200) + 'deep' + '</div>'.repeat(200);
      expect(() => parseWiki(source)).not.toThrow();
    });

    it('parses a large document quickly', () => {
      // The old parser was quadratic; 200 kB of source took it many seconds.
      const source = '# Heading\nSome *text* with a [link](https://example.com).\n'.repeat(2000);

      const started = performance.now();
      const nodes = parseWiki(source);
      const elapsed = performance.now() - started;

      expect(nodes.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
