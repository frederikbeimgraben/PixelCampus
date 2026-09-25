import { describe, expect, it } from 'vitest';

import { cssColor, toComponent, toFormattedLines, toServerStatus } from './server-status';

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

describe('toComponent', () => {
  it('passes a component tree through', () => {
    const tree = { text: '', extra: [{ text: 'Pixel', color: 'aqua' }] };
    expect(toComponent(tree)).toBe(tree);
  });

  it('reads a bare string as the text of one component', () => {
    expect(toFormattedLines(toComponent('first\nsecond'))).toHaveLength(2);
  });

  it('reads an array as the children of one component', () => {
    const lines = toFormattedLines(toComponent(['one ', { text: 'two', color: 'red' }]));

    expect(lines[0]?.map((span) => span.text).join('')).toBe('one two');
    expect(lines[0]?.[1]?.color).toBe('#ff5555');
  });

  it('gives an empty component for a description that is absent', () => {
    expect(toComponent(undefined)).toEqual({});
    expect(toComponent(null)).toEqual({});
  });
});

describe('toServerStatus', () => {
  const INFO = {
    name: 'PixelCampus',
    motd: 'PixelCampus',
    version: 'Paper 1.21.4',
    online: true,
    playerCount: 3,
    maxPlayerCount: 60,
    players: ['Alex', 'Steve'],
    description: { text: 'Pixel', color: 'aqua', extra: [{ text: 'Campus', bold: true }] },
    latencyMs: 42,
  };

  it('draws the MOTD from the tree, not from the plain text', () => {
    const status = toServerStatus(INFO);

    expect(status.description[0]?.[0]).toEqual({
      text: 'Pixel',
      color: '#55ffff',
      fontFamily: 'Minecraft Regular',
    });
    expect(status.description[0]?.[1]?.fontFamily).toBe('Minecraft Bold');
  });

  it('carries the latency, the counts and the version over', () => {
    expect(toServerStatus(INFO)).toMatchObject({
      online: true,
      latencyMs: 42,
      playerCount: 3,
      maxPlayerCount: 60,
      players: ['Alex', 'Steve'],
      version: 'Paper 1.21.4',
    });
  });

  it('shows an offline server with no latency, which the banner reads as offline', () => {
    const { description: _omitted, ...rest } = INFO;
    const status = toServerStatus({ ...rest, online: false, latencyMs: 0, version: 'unknown' });

    expect(status.online).toBe(false);
    expect(status.latencyMs).toBe(0);
    expect(status.description).toEqual([]);
    expect(status.version).toBe('???');
  });

  it('reads an answer without a latency as offline rather than failing', () => {
    const { latencyMs: _omitted, ...rest } = INFO;
    expect(toServerStatus(rest).latencyMs).toBe(0);
  });
});
