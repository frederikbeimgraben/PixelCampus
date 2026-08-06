import { describe, expect, it } from 'vitest';

import { playerName, toGear } from '../src/adapters/servertap.js';

describe('toGear', () => {
  it('maps a full armour set', () => {
    const gear = toGear({
      helmet: { type: 'DIAMOND_HELMET', amount: 1 },
      chestplate: { type: 'NETHERITE_CHESTPLATE', amount: 1 },
      leggings: { type: 'IRON_LEGGINGS', amount: 1 },
      boots: { type: 'LEATHER_BOOTS', amount: 1 },
      mainHand: { type: 'DIAMOND_SWORD', amount: 1 },
      offHand: { type: 'SHIELD', amount: 1 },
    });

    expect(gear.helmet?.id).toBe('minecraft:diamond_helmet');
    expect(gear.chestplate?.name).toBe('Netherite Chestplate');
    expect(gear.offHand?.name).toBe('Shield');
  });

  it('reports empty slots as null', () => {
    const gear = toGear({});
    expect(gear.helmet).toBeNull();
    expect(gear.mainHand).toBeNull();
  });

  it('falls back to itemInHand on older plugin builds', () => {
    const gear = toGear({ itemInHand: { type: 'NETHERITE_PICKAXE' } });
    expect(gear.mainHand?.id).toBe('minecraft:netherite_pickaxe');
  });

  it('keeps an already namespaced id', () => {
    const gear = toGear({ helmet: { id: 'minecraft:turtle_helmet' } });
    expect(gear.helmet?.id).toBe('minecraft:turtle_helmet');
  });

  it('formats enchantments with roman numerals', () => {
    const gear = toGear({
      mainHand: {
        type: 'DIAMOND_SWORD',
        enchantments: [
          { name: 'SHARPNESS', level: 5 },
          { name: 'UNBREAKING', level: 3 },
          { name: 'MENDING', level: 1 },
        ],
      },
    });

    expect(gear.mainHand?.enchantments).toEqual(['Sharpness V', 'Unbreaking III', 'Mending']);
  });

  describe('durability', () => {
    it('computes the remaining fraction from damage', () => {
      const gear = toGear({ mainHand: { type: 'IRON_SWORD', damage: 62, maxDurability: 250 } });
      expect(gear.mainHand?.durability).toBeCloseTo(0.752, 3);
    });

    it('prefers a directly reported durability', () => {
      const gear = toGear({ mainHand: { type: 'IRON_SWORD', durability: 125, maxDurability: 250 } });
      expect(gear.mainHand?.durability).toBeCloseTo(0.5, 3);
    });

    it('is null for items that do not wear', () => {
      const gear = toGear({ mainHand: { type: 'DIRT', amount: 64 } });
      expect(gear.mainHand?.durability).toBeNull();
    });

    it('clamps out-of-range values', () => {
      const gear = toGear({ mainHand: { type: 'IRON_SWORD', durability: 900, maxDurability: 250 } });
      expect(gear.mainHand?.durability).toBe(1);
    });
  });
});

describe('playerName', () => {
  it('prefers the display name', () => {
    expect(playerName({ displayName: 'Steve', name: 'steve_raw', uuid: 'x' })).toBe('Steve');
  });

  it('falls back to the uuid', () => {
    expect(playerName({ uuid: 'abc' })).toBe('abc');
  });
});
