import { describe, expect, it } from 'vitest';

import { formatBlocks, formatCount, formatDate, formatDuration, formatValue } from './format';

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

describe('formatBlocks', () => {
  it('keeps small distances in blocks', () => {
    expect(formatBlocks(0)).toBe('0 blocks');
    expect(formatBlocks(999)).toBe('999 blocks');
  });

  it('switches to kilometres past a thousand', () => {
    expect(formatBlocks(1000)).toBe('1.0 km');
    expect(formatBlocks(812_400)).toBe('812.4 km');
  });

  it('rejects negative and non-finite input', () => {
    expect(formatBlocks(-5)).toBe('0');
    expect(formatBlocks(Number.NaN)).toBe('0');
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
    expect(formatValue(1500, 'blocks')).toBe('1.5 km');
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
