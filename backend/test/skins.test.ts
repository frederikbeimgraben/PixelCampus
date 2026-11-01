import { describe, expect, it } from 'vitest';

import { renderUrl } from '../src/adapters/skins.js';

const UUID = '2a089bbf-36f9-442e-8669-8a339500c8de';

describe('renderUrl', () => {
  it('builds minotar paths', () => {
    expect(renderUrl('https://minotar.net/', 'minotar', 'head', UUID, 64)).toBe(
      `https://minotar.net/helm/${UUID}/64`,
    );
    expect(renderUrl('https://minotar.net', 'minotar', 'body', UUID, 128)).toBe(
      `https://minotar.net/armor/body/${UUID}/128`,
    );
    expect(renderUrl('https://minotar.net', 'minotar', 'texture', UUID, 64)).toBe(
      `https://minotar.net/skin/${UUID}`,
    );
  });

  it('builds mc-heads paths', () => {
    expect(renderUrl('https://mc-heads.net', 'mc-heads', 'head', UUID, 64)).toBe(
      `https://mc-heads.net/avatar/${UUID}/64`,
    );
    expect(renderUrl('https://mc-heads.net', 'mc-heads', 'body', UUID, 128)).toBe(
      `https://mc-heads.net/body/${UUID}/128`,
    );
    expect(renderUrl('https://mc-heads.net', 'mc-heads', 'texture', UUID, 64)).toBe(
      `https://mc-heads.net/skin/${UUID}`,
    );
  });
});
