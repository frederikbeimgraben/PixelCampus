import { z } from 'zod';

import type { Config } from '../config.js';
import type { GearItem, PlayerGear, ServerInfo } from '../domain/models.js';
import { NotConfiguredError } from '../lib/errors.js';
import { fetchJson } from '../lib/http.js';

/*
 * Shapes below were taken from a live ServerTap 0.6.1 on Purpur 1.20.4. Fields
 * stay optional because ServerTap changes its payloads between releases, and an
 * unexpected key must not turn into a 500 for the whole page.
 */

const playerSchema = z
  .object({
    uuid: z.string().optional(),
    displayName: z.string().optional(),
    name: z.string().optional(),
    health: z.number().optional(),
    hunger: z.number().optional(),
    exp: z.number().optional(),
    gamemode: z.string().optional(),
  })
  .loose();

const itemSchema = z
  .object({
    id: z.string().optional(),
    count: z.number().optional(),
    slot: z.number().optional(),
  })
  .loose();

const worldSchema = z.object({ uuid: z.string().optional(), name: z.string().optional() }).loose();

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
export type ServerTapItem = z.infer<typeof itemSchema>;

/**
 * Bukkit inventory slot numbers for worn equipment. ServerTap returns one flat
 * list for the whole inventory, so the slot is the only thing identifying what
 * is actually equipped.
 */
const ARMOUR_SLOTS = { boots: 36, leggings: 37, chestplate: 38, helmet: 39 } as const;
const OFF_HAND_SLOT = 40;

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
   * Reads a player's worn equipment.
   *
   * The player object carries no equipment, so this reads the inventory and
   * picks out the armour and off-hand slots.
   *
   * @param uuid Player UUID.
   * @returns The equipped items, or null when the inventory cannot be read.
   */
  async gear(uuid: string): Promise<PlayerGear | null> {
    const worldUuid = await this.primaryWorldUuid();
    if (worldUuid === null) return null;

    const raw = await this.get(
      `/v1/players/${encodeURIComponent(uuid)}/${encodeURIComponent(worldUuid)}/inventory`,
    );

    const parsed = z.array(itemSchema).safeParse(raw);
    return parsed.success ? toGear(parsed.data) : null;
  }

  /** @returns UUID of the first world, which owns the player inventories. */
  private async primaryWorldUuid(): Promise<string | null> {
    const raw = await this.get('/v1/worlds');
    const parsed = z.array(worldSchema).safeParse(raw);
    if (!parsed.success) return null;

    return parsed.data.find((world) => world.uuid !== undefined)?.uuid ?? null;
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
 * Picks the equipped items out of a flat inventory listing.
 *
 * mainHand stays null: it is whatever is in the selected hotbar slot, and
 * ServerTap 0.6.1 does not report which slot that is. Guessing slot 0 would be
 * wrong for any player who has moved their hand off the first slot.
 *
 * @param items Inventory as returned by ServerTap.
 * @returns The six equipment slots, each null when empty or unknown.
 */
export function toGear(items: readonly ServerTapItem[]): PlayerGear {
  const bySlot = new Map<number, ServerTapItem>();
  for (const item of items) {
    if (item.slot !== undefined) bySlot.set(item.slot, item);
  }

  const at = (slot: number): GearItem | null => toGearItem(bySlot.get(slot));

  return {
    helmet: at(ARMOUR_SLOTS.helmet),
    chestplate: at(ARMOUR_SLOTS.chestplate),
    leggings: at(ARMOUR_SLOTS.leggings),
    boots: at(ARMOUR_SLOTS.boots),
    mainHand: null,
    offHand: at(OFF_HAND_SLOT),
  };
}

function toGearItem(item: ServerTapItem | undefined): GearItem | null {
  if (!item?.id) return null;

  return {
    id: namespaced(item.id),
    name: humanise(item.id),
    amount: item.count ?? 1,
    // ServerTap 0.6.1 reports neither enchantments nor damage. The fields stay
    // in the model so a richer source can fill them without a schema change.
    enchantments: [],
    durability: null,
  };
}

/** `DIAMOND_SWORD` becomes `minecraft:diamond_sword`. */
function namespaced(material: string): string {
  return material.includes(':') ? material.toLowerCase() : `minecraft:${material.toLowerCase()}`;
}

/** `minecraft:diamond_sword` becomes `Diamond Sword`. */
function humanise(material: string): string {
  return material
    .replace(/^.*:/, '')
    .toLowerCase()
    .split('_')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
