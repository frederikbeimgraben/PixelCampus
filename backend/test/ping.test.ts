import { describe, expect, it } from 'vitest';

import { motdText, toServerInfo } from '../src/adapters/ping.js';

/*
 * The answer to a server list ping, as a Paper 1.20.4 server sends it. The
 * description is a chat component tree, and the sample holds a few of the names
 * of the players who are connected.
 */
const PING_STATUS = {
  version: { name: 'Paper 1.20.4', protocol: 765 },
  players: {
    max: 20,
    online: 2,
    sample: [
      { name: 'thehiggsboson', id: '2a089bbf-36f9-442e-8669-8a339500c8de' },
      { name: 'StatBot', id: '6035c7d9-0654-332b-89c2-5ff4218935e2' },
    ],
  },
  description: {
    text: '',
    extra: [
      { text: 'Pixel', color: 'aqua' },
      { text: 'Campus ', color: 'white' },
      { text: '» ', color: 'dark_gray' },
      { text: 'local test server', color: 'gray' },
    ],
  },
  favicon: 'data:image/png;base64,iVBORw0KGgo=',
};

describe('motdText', () => {
  it('joins the runs of a component tree in order', () => {
    expect(motdText(PING_STATUS.description)).toBe('PixelCampus » local test server');
  });

  it('reads a description that is a plain string', () => {
    expect(motdText('A Minecraft Server')).toBe('A Minecraft Server');
  });

  it('drops the legacy formatting codes', () => {
    expect(motdText('§bPixel§fCampus §8» §7local test server')).toBe(
      'PixelCampus » local test server',
    );
  });

  it('keeps the break between the two lines of a MOTD', () => {
    expect(motdText({ text: 'first line\nsecond line' })).toBe('first line\nsecond line');
  });

  it('reads the text of a parent before the text of its children', () => {
    expect(motdText({ text: 'one ', extra: [{ text: 'two' }] })).toBe('one two');
  });

  it('gives an empty string for a description that is absent', () => {
    expect(motdText(undefined)).toBe('');
  });
});

describe('toServerInfo', () => {
  it('reads the version, the counts and the sample', () => {
    const info = toServerInfo(PING_STATUS, 'PixelCampus');

    expect(info).toEqual({
      name: 'PixelCampus',
      motd: 'PixelCampus » local test server',
      version: 'Paper 1.20.4',
      online: true,
      playerCount: 2,
      maxPlayerCount: 20,
      players: ['thehiggsboson', 'StatBot'],
    });
  });

  it('answers with an empty list when the server sends no sample', () => {
    const info = toServerInfo({ players: { online: 30, max: 40 } }, 'PixelCampus');

    expect(info.players).toEqual([]);
    expect(info.playerCount).toBe(30);
  });

  it('holds a server that answers something unexpected', () => {
    const info = toServerInfo({ players: 'not an object' }, 'PixelCampus');

    expect(info.online).toBe(true);
    expect(info.version).toBe('unknown');
    expect(info.playerCount).toBe(0);
  });
});
