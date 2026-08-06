import { z } from 'zod';

import type { Config } from '../config.js';
import type { GearItem, PlayerGear, ServerInfo } from '../domain/models.js';
import { NotConfiguredError } from '../lib/errors.js';
import { fetchJson } from '../lib/http.js';

/*
 * ServerTap's payloads differ between plugin versions, so every schema here is
 * loose and every field optional: an unexpected extra field must not turn into
 * a 500 for the whole page. Anything missing degrades to a null or a zero.
 */

const enchantmentSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    level: z.number().optional(),
  })
  .loose();

const itemSchema = z
  .object({
    type: z.string().optional(),
    material: z.string().optional(),
    id: z.string().optional(),
    amount: z.number().optional(),
    durability: z.number().optional(),
    damage: z.number().optional(),
    maxDurability: z.number().optional(),
    enchantments: z.array(enchantmentSchema).optional(),
  })
  .loose();

const playerSchema = z
  .object({
    uuid: z.string().optional(),
    displayName: z.string().optional(),
    name: z.string().optional(),
    health: z.number().optional(),
    hunger: z.number().optional(),
    foodLevel: z.number().optional(),
    level: z.number().optional(),
    helmet: itemSchema.nullish(),
    chestplate: itemSchema.nullish(),
    leggings: itemSchema.nullish(),
    boots: itemSchema.nullish(),
    itemInHand: itemSchema.nullish(),
    mainHand: itemSchema.nullish(),
    offHand: itemSchema.nullish(),
  })
  .loose();

const serverSchema = z
  .object({
    name: z.string().optional(),
    motd: z.string().optional(),
    version: z.string().optional(),
    onlinePlayers: z.number().optional(),
    maxPlayers: z.number().optional(),
  })
  .loose();

export type ServerTapPlayer = z.infer<typeof playerSchema>;
type ServerTapItem = z.infer<typeof itemSchema>;

/** Reads live state from the ServerTap plugin. */
export class ServerTapAdapter {
  constructor(private readonly config: Config) {}

  get configured(): boolean {
    return this.config.serverTapConfigured;
  }

  /**
   * @returns Server name, version and player counts.
   * @throws {NotConfiguredError} If SERVERTAP_URL is unset.
   * @throws {UpstreamError} If ServerTap is unreachable or unusable.
   */
  async server(): Promise<ServerInfo> {
    const raw = await this.get('/v1/server');
    const parsed = serverSchema.safeParse(raw);
    const data = parsed.success ? parsed.data : {};
    const players = await this.onlinePlayers();

    return {
      name: data.name ?? 'PixelCampus',
      motd: data.motd ?? '',
      version: data.version ?? 'unknown',
      online: true,
      playerCount: data.onlinePlayers ?? players.length,
      maxPlayerCount: data.maxPlayers ?? 0,
      players: players.map((player) => playerName(player)),
    };
  }

  /**
   * @returns Every currently connected player.
   * @throws {NotConfiguredError} If SERVERTAP_URL is unset.
   */
  async onlinePlayers(): Promise<readonly ServerTapPlayer[]> {
    const raw = await this.get('/v1/players');
    const parsed = z.array(playerSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  }

  /**
   * @param uuid Player UUID.
   * @returns The player, or null when not connected.
   */
  async player(uuid: string): Promise<ServerTapPlayer | null> {
    const raw = await this.get(`/v1/players/${encodeURIComponent(uuid)}`);
    if (raw === null) return null;

    const parsed = playerSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private async get(path: string): Promise<unknown> {
    if (!this.config.SERVERTAP_URL) {
      throw new NotConfiguredError('ServerTap');
    }

    const headers: Record<string, string> = {};
    if (this.config.SERVERTAP_KEY) {
      headers['key'] = this.config.SERVERTAP_KEY;
    }

    return fetchJson(`${trimSlash(this.config.SERVERTAP_URL)}${path}`, {
      timeoutMs: this.config.UPSTREAM_TIMEOUT_MS,
      upstream: 'ServerTap',
      headers,
    });
  }
}

/** Display name of a ServerTap player, falling back to the UUID. */
export function playerName(player: ServerTapPlayer): string {
  return player.displayName ?? player.name ?? player.uuid ?? 'unknown';
}

/**
 * @param player Live player from ServerTap.
 * @returns The six equipment slots, each null when empty.
 */
export function toGear(player: ServerTapPlayer): PlayerGear {
  return {
    helmet: toGearItem(player.helmet),
    chestplate: toGearItem(player.chestplate),
    leggings: toGearItem(player.leggings),
    boots: toGearItem(player.boots),
    mainHand: toGearItem(player.mainHand ?? player.itemInHand),
    offHand: toGearItem(player.offHand),
  };
}

function toGearItem(item: ServerTapItem | null | undefined): GearItem | null {
  if (!item) return null;

  const material = item.type ?? item.material ?? item.id;
  if (!material) return null;

  return {
    id: namespaced(material),
    name: humanise(material),
    amount: item.amount ?? 1,
    enchantments: (item.enchantments ?? []).map(describeEnchantment).filter((line) => line !== ''),
    durability: durabilityFraction(item),
  };
}

/**
 * @returns Remaining durability from 0 to 1, or null when the item does not wear
 *   or the plugin did not report a maximum.
 */
function durabilityFraction(item: ServerTapItem): number | null {
  const max = item.maxDurability;
  if (typeof max !== 'number' || max <= 0) return null;

  // Older builds report `damage` (used up); newer ones report `durability` (left).
  const used = typeof item.damage === 'number' ? item.damage : undefined;
  const left = typeof item.durability === 'number' ? item.durability : undefined;

  const remaining = left ?? (used === undefined ? undefined : max - used);
  if (remaining === undefined) return null;

  return Math.min(1, Math.max(0, remaining / max));
}

function describeEnchantment(enchantment: z.infer<typeof enchantmentSchema>): string {
  const name = enchantment.name ?? enchantment.id;
  if (!name) return '';

  const level = enchantment.level;
  return level === undefined || level <= 1
    ? humanise(name)
    : `${humanise(name)} ${roman(level)}`;
}

/** `DIAMOND_SWORD` becomes `minecraft:diamond_sword`. */
function namespaced(material: string): string {
  return material.includes(':') ? material.toLowerCase() : `minecraft:${material.toLowerCase()}`;
}

/** `DIAMOND_SWORD` becomes `Diamond Sword`. */
function humanise(material: string): string {
  return material
    .replace(/^.*:/, '')
    .toLowerCase()
    .split('_')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const ROMAN: readonly (readonly [number, string])[] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function roman(value: number): string {
  let remaining = Math.min(Math.max(Math.floor(value), 1), 40);
  let result = '';

  for (const [amount, numeral] of ROMAN) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }

  return result;
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
