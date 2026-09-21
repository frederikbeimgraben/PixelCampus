import { describe, expect, it } from 'vitest';

import { formatCount, formatDate, formatDuration, formatValue } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [59_000, '0m'],
    [90_000, '1m'],
    [3_600_000, '1h 0m'],
    [4_500_000, '1h 15m'],
    [356_400_000, '4d 3h'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('treats negative and non-finite input as zero', () => {
    expect(formatDuration(-1)).toBe('0m');
    expect(formatDuration(Number.NaN)).toBe('0m');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0m');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(94_012)).toBe('94,012');
  });

  it('rounds', () => {
    expect(formatCount(12.6)).toBe('13');
  });

  it('falls back to zero for non-finite input', () => {
    expect(formatCount(Number.NaN)).toBe('0');
  });
});

describe('formatValue', () => {
  it('picks the formatter from the unit', () => {
    expect(formatValue(356_400_000, 'ms')).toBe('4d 3h');
    expect(formatValue(1234, 'count')).toBe('1,234');
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp', () => {
    expect(formatDate('2025-01-01T00:00:00.000Z')).toBe('01/01/2025');
  });

  it('returns a dash for null or unparseable input', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('not a date')).toBe('-');
  });
});
