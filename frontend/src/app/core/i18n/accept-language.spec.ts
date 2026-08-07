import { describe, expect, it } from 'vitest';

import { preferredLanguages } from './accept-language';
import { DEFAULT_LANGUAGE, resolveLanguage } from './i18n';

describe('preferredLanguages', () => {
  it('reads a single tag', () => {
    expect(preferredLanguages('de')).toEqual(['de']);
  });

  it('orders by quality rather than by position', () => {
    expect(preferredLanguages('de;q=0.5,en;q=0.9')).toEqual(['en', 'de']);
  });

  it('treats a tag with no quality as the most preferred', () => {
    expect(preferredLanguages('en-GB,de;q=0.9')).toEqual(['en-GB', 'de']);
  });

  it('drops a tag the client explicitly refuses', () => {
    expect(preferredLanguages('de,en;q=0')).toEqual(['de']);
  });

  it('drops the wildcard, which names no language', () => {
    expect(preferredLanguages('*')).toEqual([]);
  });

  it('returns nothing for an absent or empty header', () => {
    expect(preferredLanguages(null)).toEqual([]);
    expect(preferredLanguages('   ')).toEqual([]);
  });

  it('feeds resolveLanguage, which is what the header is for', () => {
    expect(resolveLanguage(null, preferredLanguages('en-GB,en;q=0.9,de;q=0.5'))).toBe('en');
    expect(resolveLanguage(null, preferredLanguages('fr'))).toBe(DEFAULT_LANGUAGE);
  });
});
