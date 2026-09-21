import { describe, expect, it } from 'vitest';

import { cssColor, toFormattedLines } from './server-status';

describe('cssColor', () => {
  it('draws a named color the way the game draws it, not the way CSS does', () => {
    // CSS has a gold and a gray of its own, in another shade. Passing the name
    // through gave the right word and the wrong color.
    expect(cssColor('gold', '#ffffff')).toBe('#ffaa00');
    expect(cssColor('gray', '#ffffff')).toBe('#aaaaaa');
    expect(cssColor('red', '#ffffff')).toBe('#ff5555');
  });

  it('draws a name that CSS does not know at all', () => {
    // These were dropped as invalid, and the text stayed the inherited color.
    expect(cssColor('dark_red', '#ffffff')).toBe('#aa0000');
    expect(cssColor('dark_gray', '#ffffff')).toBe('#555555');
    expect(cssColor('light_purple', '#ffffff')).toBe('#ff55ff');
  });

  it('keeps a color the server states itself', () => {
    expect(cssColor('#FF0000', '#ffffff')).toBe('#FF0000');
  });

  it('keeps the inherited color when none is stated or the value is not one', () => {
    expect(cssColor(undefined, '#aa0000')).toBe('#aa0000');
    expect(cssColor('', '#aa0000')).toBe('#aa0000');
    expect(cssColor('chartreuse', '#aa0000')).toBe('#aa0000');
  });
});

describe('toFormattedLines', () => {
  it('reads a MOTD that colors every letter on its own', () => {
    // The shape a proxy sends for a gradient: a tree of one component per
    // letter, nested two levels deep.
    const description = {
      extra: [
        {
          text: '',
          extra: [{ text: '', extra: [{ color: 'dark_red', text: 'P' }] }],
        },
        { text: ' ' },
        { extra: [{ color: 'gold', text: 'N' }] },
      ],
      text: '',
    };

    const lines = toFormattedLines(description);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.map((span) => span.text).join('')).toBe('P N');
    expect(lines[0]?.[0]?.color).toBe('#aa0000');
    expect(lines[0]?.[2]?.color).toBe('#ffaa00');
  });

  it('gives a child the color of its parent', () => {
    const lines = toFormattedLines({
      text: '',
      color: 'dark_red',
      extra: [{ text: 'inherited' }],
    });

    expect(lines[0]?.[0]?.color).toBe('#aa0000');
  });

  it('puts each line of a MOTD on a line of its own', () => {
    const lines = toFormattedLines({ text: 'first\nsecond' });

    expect(lines).toHaveLength(2);
    expect(lines[0]?.[0]?.text).toBe('first');
    expect(lines[1]?.[0]?.text).toBe('second');
  });

  it('reads the text of a component before the text of its children', () => {
    const lines = toFormattedLines({ text: 'one ', extra: [{ text: 'two' }] });

    expect(lines[0]?.map((span) => span.text).join('')).toBe('one two');
  });

  it('gives no lines for a description that is absent', () => {
    expect(toFormattedLines({})).toEqual([]);
  });
});
