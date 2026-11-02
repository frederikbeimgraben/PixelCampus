import { describe, expect, it } from 'vitest';

import { wikiLinkAction } from './wiki-links';

describe('wikiLinkAction', () => {
  it('routes links to wiki pages inside the app', () => {
    expect(wikiLinkAction('/wiki/erste-schritte')).toEqual({
      kind: 'route',
      url: '/wiki/erste-schritte',
    });
    expect(wikiLinkAction('/wiki/regeln#bkmrk-pvp')).toEqual({
      kind: 'route',
      url: '/wiki/regeln#bkmrk-pvp',
    });
    expect(wikiLinkAction('/wiki')).toEqual({ kind: 'route', url: '/wiki' });
  });

  it('scrolls to a bookmark on the same page', () => {
    expect(wikiLinkAction('#bkmrk-java')).toEqual({ kind: 'anchor', id: 'bkmrk-java' });
  });

  it('leaves every other link to the browser', () => {
    expect(wikiLinkAction('https://minecraft.net/')).toEqual({ kind: 'default' });
    expect(wikiLinkAction('/api/v1/wiki/images/uploads/images/a.png')).toEqual({
      kind: 'default',
    });
    expect(wikiLinkAction('/wiki/../stats')).toEqual({ kind: 'default' });
    expect(wikiLinkAction('#')).toEqual({ kind: 'default' });
    expect(wikiLinkAction(null)).toEqual({ kind: 'default' });
  });
});
