/**
 * Dev-server proxy.
 *
 * The app calls the API under /api/v1 on its own origin, because that is what
 * production serves through nginx. `ng serve` is that origin during
 * development, so it has to forward that path itself.
 *
 * The target comes from .env; see .env.example. Unlike the other settings it
 * is read when the dev server starts, not compiled into the bundle.
 */

import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const stats = process.env['PC_DEV_API_TARGET']?.trim() || 'http://127.0.0.1:8080';

export default {
  // ws so /api/v1/live is upgraded rather than answered as a plain request.
  '/api/v1': { target: stats, changeOrigin: true, ws: true },
};
