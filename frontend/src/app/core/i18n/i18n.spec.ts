import { describe, expect, it } from 'vitest';

import { resolveLanguage } from './i18n';

describe('resolveLanguage', () => {
  it('prefers a previous choice over the browser', () => {
    expect(resolveLanguage('en', ['de-DE'])).toBe('en');
    expect(resolveLanguage('de', ['en-GB'])).toBe('de');
  });

  it('falls back to the browser preference', () => {
    expect(resolveLanguage(null, ['en-GB', 'de'])).toBe('en');
  });

  it('ignores the region on a language tag', () => {
    expect(resolveLanguage(null, ['de-AT'])).toBe('de');
    expect(resolveLanguage(null, ['EN-us'])).toBe('en');
  });

  it('skips languages the site does not have', () => {
    expect(resolveLanguage(null, ['fr-FR', 'it', 'en-US'])).toBe('en');
  });

  it('defaults to German, the server being a German university one', () => {
    expect(resolveLanguage(null, [])).toBe('de');
    expect(resolveLanguage(null, ['fr', 'es'])).toBe('de');
  });

  it('ignores a stored value that is not a supported language', () => {
    expect(resolveLanguage('klingon', ['en'])).toBe('en');
  });
});
