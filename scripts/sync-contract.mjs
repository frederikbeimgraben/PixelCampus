#!/usr/bin/env node
/**
 * Copies the API contract into each package that compiles it.
 *
 * shared/src is the only place the contract is edited. The copies exist because
 * the contract imports zod and @orpc/contract, and TypeScript and esbuild both
 * resolve those by walking up from the importing file: a shared/ directory
 * outside either package has no node_modules to find. Copying the sources in
 * lets each package resolve them from its own dependencies, which is also what
 * makes the Nix builds work, where only one package's modules are installed.
 *
 * The copies are generated and gitignored.
 *
 * Usage: sync-contract.mjs [backend|frontend]
 * With no argument both are synced. Naming one matters in the Nix builds, where
 * only the package being built is writable.
 */

import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'shared', 'src');

const PACKAGES = ['backend', 'frontend'];
const requested = process.argv[2];

if (requested !== undefined && !PACKAGES.includes(requested)) {
  throw new Error(`Unknown package "${requested}"; expected one of ${PACKAGES.join(', ')}`);
}

const TARGETS = (requested === undefined ? PACKAGES : [requested]).map((pkg) =>
  join(root, pkg, 'src', 'contract'),
);

const files = (await readdir(source)).filter((name) => name.endsWith('.ts'));
if (files.length === 0) {
  throw new Error(`No contract sources in ${source}`);
}

for (const target of TARGETS) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const name of files) {
    await cp(join(source, name), join(target, name));
  }
}

console.log(`Synced ${files.length} contract files into ${TARGETS.length} packages`);
