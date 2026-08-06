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
];

const args = process.argv.slice(2);
const options = {
  version: args.find((a) => a.startsWith('--version='))?.split('=')[1],
  dryRun: args.includes('--dry-run'),
  prune: args.includes('--prune'),
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
  const animated = new Set(
    entries
      .filter((e) => e.entryName.endsWith('.png.mcmeta'))
      .map((e) => e.entryName.replace(/\.mcmeta$/, '')),
  );

  for (const target of TARGETS) {
    await extract(entries, animated, target);
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
