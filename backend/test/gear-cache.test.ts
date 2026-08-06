import { describe, expect, it } from 'vitest';

import { GearCache } from '../src/domain/gear-cache.js';
import type { PlayerGear } from '../src/domain/models.js';

const EMPTY: PlayerGear = {
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
  mainHand: null,
  offHand: null,
};

function gearWith(helmetId: string): PlayerGear {
  return {
    ...EMPTY,
    helmet: { id: helmetId, name: helmetId, amount: 1, enchantments: [], durability: null },
  };
}

describe('GearCache', () => {
  it('recalls what was remembered', () => {
    const cache = new GearCache();
    cache.remember('a', gearWith('minecraft:diamond_helmet'));

    expect(cache.recall('a')?.gear.helmet?.id).toBe('minecraft:diamond_helmet');
  });

  it('returns null for a player never seen', () => {
    expect(new GearCache().recall('nobody')).toBeNull();
  });

  it('records when the reading was taken', () => {
    const cache = new GearCache();
    cache.remember('a', EMPTY, new Date('2026-08-06T12:00:00.000Z'));

    expect(cache.recall('a')?.capturedAt).toBe('2026-08-06T12:00:00.000Z');
  });

  it('replaces an earlier reading', () => {
    const cache = new GearCache();
    cache.remember('a', gearWith('minecraft:leather_helmet'));
    cache.remember('a', gearWith('minecraft:netherite_helmet'));

    expect(cache.recall('a')?.gear.helmet?.id).toBe('minecraft:netherite_helmet');
    expect(cache.size).toBe(1);
  });

  it('ignores an empty uuid', () => {
    const cache = new GearCache();
    cache.remember('', EMPTY);

    expect(cache.size).toBe(0);
  });

  describe('capacity', () => {
    it('drops the least recently written entry', () => {
      const cache = new GearCache(2);
      cache.remember('a', EMPTY);
      cache.remember('b', EMPTY);
      cache.remember('c', EMPTY);

      expect(cache.recall('a')).toBeNull();
      expect(cache.recall('b')).not.toBeNull();
      expect(cache.recall('c')).not.toBeNull();
      expect(cache.size).toBe(2);
    });

    it('counts a rewrite as recent, so it is not the one dropped', () => {
      const cache = new GearCache(2);
      cache.remember('a', EMPTY);
      cache.remember('b', EMPTY);
      cache.remember('a', EMPTY);
      cache.remember('c', EMPTY);

      expect(cache.recall('a')).not.toBeNull();
      expect(cache.recall('b')).toBeNull();
    });
  });
});
