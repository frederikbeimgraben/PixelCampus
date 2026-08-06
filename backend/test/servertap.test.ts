import { describe, expect, it } from 'vitest';

import { playerName, toGear } from '../src/adapters/servertap.js';

/*
 * Fixtures below are real ServerTap 0.6.1 output, captured from a Purpur 1.20.4
 * server with a player wearing the gear.
 */

describe('toGear', () => {
  it('reads worn armour and the off hand out of the inventory slots', () => {
    const gear = toGear([
      { count: 1, slot: 0, id: 'minecraft:netherite_chestplate' },
      { count: 64, slot: 2, id: 'minecraft:dirt' },
      { count: 1, slot: 36, id: 'minecraft:leather_boots' },
      { count: 1, slot: 37, id: 'minecraft:diamond_leggings' },
      { count: 1, slot: 38, id: 'minecraft:netherite_chestplate' },
      { count: 1, slot: 39, id: 'minecraft:diamond_helmet' },
      { count: 1, slot: 40, id: 'minecraft:shield' },
    ]);

    expect(gear.helmet?.id).toBe('minecraft:diamond_helmet');
    expect(gear.chestplate?.name).toBe('Netherite Chestplate');
    expect(gear.leggings?.id).toBe('minecraft:diamond_leggings');
    expect(gear.boots?.id).toBe('minecraft:leather_boots');
    expect(gear.offHand?.name).toBe('Shield');
  });

  it('ignores items carried but not worn', () => {
    // Slot 0 holds a chestplate in the backpack, which is not equipment.
    const gear = toGear([{ count: 1, slot: 0, id: 'minecraft:netherite_chestplate' }]);

    expect(gear.chestplate).toBeNull();
  });

  it('leaves the main hand unknown', () => {
    // ServerTap 0.6.1 does not say which hotbar slot is selected.
    const gear = toGear([{ count: 1, slot: 0, id: 'minecraft:diamond_sword' }]);

    expect(gear.mainHand).toBeNull();
  });

  it('reports empty slots as null', () => {
    const gear = toGear([]);

    expect(gear.helmet).toBeNull();
    expect(gear.offHand).toBeNull();
  });

  it('keeps the stack size', () => {
    const gear = toGear([{ count: 12, slot: 40, id: 'minecraft:snowball' }]);

    expect(gear.offHand?.amount).toBe(12);
  });

  it('namespaces a bare id', () => {
    const gear = toGear([{ count: 1, slot: 39, id: 'DIAMOND_HELMET' }]);

    expect(gear.helmet?.id).toBe('minecraft:diamond_helmet');
    expect(gear.helmet?.name).toBe('Diamond Helmet');
  });

  it('reports no enchantments or durability, which this plugin does not send', () => {
    const gear = toGear([{ count: 1, slot: 39, id: 'minecraft:diamond_helmet' }]);

    expect(gear.helmet?.enchantments).toEqual([]);
    expect(gear.helmet?.durability).toBeNull();
  });

  it('skips items with no slot', () => {
    const gear = toGear([{ count: 1, id: 'minecraft:diamond_helmet' }]);

    expect(gear.helmet).toBeNull();
  });
});

describe('playerName', () => {
  it('prefers the display name', () => {
    expect(playerName({ displayName: 'StatBot', name: 'raw', uuid: 'x' })).toBe('StatBot');
  });

  it('falls back to the uuid', () => {
    expect(playerName({ uuid: '6035c7d9-0654-332b-89c2-5ff4218935e2' })).toBe(
      '6035c7d9-0654-332b-89c2-5ff4218935e2',
    );
  });
});
