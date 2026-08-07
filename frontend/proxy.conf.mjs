/**
 * Dev-server proxy.
 *
 * The app calls both APIs under /api on its own origin, because that is what
 * production serves through nginx. `ng serve` is that origin during
 * development, so it has to forward those paths itself.
 *
 * Targets come from .env; see .env.example. Unlike the other settings this one
 * is read when the dev server starts, not compiled into the bundle.
 */

import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const stats = process.env['PC_DEV_API_TARGET']?.trim() || 'http://127.0.0.1:8080';
const legacy = process.env['PC_DEV_LEGACY_API_TARGET']?.trim() || 'https://api.pixelcampus.space';

export default {
  '/api/v1': { target: stats, changeOrigin: true },
  '/api/minecraft': { target: legacy, changeOrigin: true },
};
