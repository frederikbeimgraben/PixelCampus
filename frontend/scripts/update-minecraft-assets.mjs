#!/usr/bin/env node
/**
 * Refreshes public/assets/items and public/assets/blocks from an official
 * Minecraft client jar.
 *
 * Textures ship inside the client jar rather than the launcher asset index, so
 * the jar is downloaded from Mojang's manifest, checked against the published
 * SHA-1, and unpacked.
 *
 * Animated textures are stored as one tall strip with frames stacked top to
 * bottom. This repo has always kept one file per frame (compass_00.png ...), so
 * strips are cut to match; existing references keep working.
 *
 * Usage:
 *   node scripts/update-minecraft-assets.mjs [--version=26.2] [--dry-run] [--prune]
 *
 * The textures are Mojang's. They are used here for a fan site for one server;
 * check the Minecraft EULA before redistributing them elsewhere.
 */

import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

const TARGETS = [
  { prefix: 'assets/minecraft/textures/item/', dest: 'public/assets/items' },
  { prefix: 'assets/minecraft/textures/block/', dest: 'public/assets/blocks' },
  // The default player skins, used when a player has none of their own.
  { prefix: 'assets/minecraft/textures/entity/player/', dest: 'public/assets/player' },
  // HUD sprites: hearts, hunger and the experience bar.
  { prefix: 'assets/minecraft/textures/gui/sprites/hud/', dest: 'public/assets/hud' },
];

/*
 * A few items are drawn from an entity model rather than a flat icon, so the
 * game ships no item texture for them and the inventory grid would be empty.
 * The face of the model is cut out of the entity texture to stand in.
 */
const ENTITY_ICONS = [
  {
    // base.png is the blank white base used for banner patterns; the plain
    // wooden shield is the nopattern one.
    source: 'assets/minecraft/textures/entity/shield/shield_base_nopattern.png',
    dest: 'public/assets/items/shield.png',
    // Front face of the shield model in its texture atlas, iron rim included.
    crop: { left: 1, top: 1, width: 12, height: 22 },
  },
  {
    source: 'assets/minecraft/textures/entity/experience/experience_orb.png',
    dest: 'public/assets/hud/experience_orb.png',
    /*
     * The texture is a 4x4 grid of animation frames. Row three holds the
     * largest, brightest orb; frame one is the smallest and nearly invisible
     * at icon size.
     */
    crop: { left: 16, top: 32, width: 16, height: 16 },
    // The game tints the orb green as it draws it; the texture is untinted.
    tint: { r: 140, g: 235, b: 70 },
  },
];

/** Side of the square every entity-cut icon is padded to. */
const ICON_SIZE = 16;

const args = process.argv.slice(2);
const options = {
  version: args.find((a) => a.startsWith('--version='))?.split('=')[1],
  dryRun: args.includes('--dry-run'),
  prune: args.includes('--prune'),
  /** Print jar entries matching this substring and stop. Paths move between versions. */
  list: args.find((a) => a.startsWith('--list='))?.split('=')[1],
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const manifest = await fetchJson(MANIFEST_URL);
  const versionId = options.version ?? manifest.latest.release;
  const entry = manifest.versions.find((v) => v.id === versionId);

  if (!entry) throw new Error(`Unknown Minecraft version "${versionId}"`);
  console.log(`Minecraft ${entry.id} (${entry.type}, released ${entry.releaseTime.slice(0, 10)})`);

  const version = await fetchJson(entry.url);
  const client = version.downloads?.client;
  if (!client) throw new Error(`Version ${entry.id} has no client download`);

  console.log(`Downloading client jar (${(client.size / 1e6).toFixed(1)} MB)...`);
  const jar = Buffer.from(await (await fetchOk(client.url)).arrayBuffer());

  const digest = createHash('sha1').update(jar).digest('hex');
  if (digest !== client.sha1) {
    throw new Error(`Client jar checksum mismatch: expected ${client.sha1}, got ${digest}`);
  }
  console.log('Checksum verified.');

  const zip = new AdmZip(jar);
  const entries = zip.getEntries();

  if (options.list !== undefined) {
    const matches = entries
      .filter((entry) => entry.entryName.includes(options.list))
      .map((entry) => entry.entryName);

    console.log(`\n${matches.length} entries matching "${options.list}":`);
    for (const name of matches.slice(0, 60)) console.log(`  ${name}`);
    return;
  }
  const animated = new Set(
    entries
      .filter((e) => e.entryName.endsWith('.png.mcmeta'))
      .map((e) => e.entryName.replace(/\.mcmeta$/, '')),
  );

  for (const target of TARGETS) {
    await extract(entries, animated, target);
  }

  await extractEntityIcons(entries);
}

/** Cuts stand-in icons for items the game draws from an entity model. */
async function extractEntityIcons(entries) {
  for (const icon of ENTITY_ICONS) {
    const entry = entries.find((candidate) => candidate.entryName === icon.source);

    if (entry === undefined) {
      console.log(`\n${icon.dest}: source ${icon.source} is not in this jar, skipped`);
      continue;
    }

    /*
     * Padded to a square rather than cropped straight to the slot. The shield
     * face is 12x22, and dropping that into a square slot stretched it.
     */
    let image = sharp(entry.getData()).extract(icon.crop).resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      kernel: 'nearest',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    if (icon.tint !== undefined) {
      image = image.tint(icon.tint);
    }

    const cut = await image.png().toBuffer();
    const status = await write(icon.dest, cut);
    console.log(`\n${icon.dest}: ${status}`);
  }
}

async function extract(entries, animated, { prefix, dest }) {
  const sources = entries.filter(
    (e) => !e.isDirectory && e.entryName.startsWith(prefix) && e.entryName.endsWith('.png'),
  );

  if (sources.length === 0) {
    throw new Error(`No textures found under ${prefix}; the jar layout may have changed`);
  }

  await mkdir(dest, { recursive: true });
  const before = new Set(await listPngs(dest));
  const written = new Set();

  let added = 0;
  let changed = 0;
  let unchanged = 0;

  for (const source of sources) {
    const base = source.entryName.slice(prefix.length).replace(/\.png$/, '');

    // Subdirectories exist for a few block sets; flatten as the repo always has.
    const name = base.replaceAll('/', '_');
    const data = source.getData();

    const frames = animated.has(source.entryName) ? await splitFrames(data) : [data];
    const single = frames.length === 1;

    for (const [index, frame] of frames.entries()) {
      const file = single ? `${name}.png` : `${name}_${String(index).padStart(2, '0')}.png`;
      written.add(file);

      const status = await write(join(dest, file), frame);
      if (status === 'added') added++;
      else if (status === 'changed') changed++;
      else unchanged++;
    }
  }

  const removed = [...before].filter((file) => !written.has(file));

  console.log(`\n${dest}`);
  console.log(`  ${written.size} textures: ${added} added, ${changed} updated, ${unchanged} unchanged`);

  if (removed.length > 0) {
    console.log(`  ${removed.length} no longer in the game: ${removed.slice(0, 8).join(', ')}${removed.length > 8 ? ', ...' : ''}`);

    if (options.prune && !options.dryRun) {
      await Promise.all(removed.map((file) => unlink(join(dest, file))));
      console.log(`  removed (--prune)`);
    } else if (!options.prune) {
      console.log(`  kept; pass --prune to delete them`);
    }
  }
}

/** Cuts a vertical animation strip into square frames. */
async function splitFrames(data) {
  const image = sharp(data);
  const { width, height } = await image.metadata();

  if (!width || !height || height <= width || height % width !== 0) {
    return [data];
  }

  const frames = [];
  for (let top = 0; top < height; top += width) {
    frames.push(
      await sharp(data).extract({ left: 0, top, width, height: width }).png().toBuffer(),
    );
  }

  return frames;
}

/** @returns 'added', 'changed' or 'unchanged'. */
async function write(path, data) {
  const existing = await readFile(path).catch(() => null);

  if (existing === null) {
    if (!options.dryRun) await writeFile(path, data);
    return 'added';
  }

  if (existing.equals(data)) return 'unchanged';

  if (!options.dryRun) await writeFile(path, data);
  return 'changed';
}

async function listPngs(dir) {
  const files = await readdir(dir).catch(() => []);
  return files.filter((file) => file.endsWith('.png'));
}

async function fetchJson(url) {
  return (await fetchOk(url)).json();
}

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
  return response;
}
