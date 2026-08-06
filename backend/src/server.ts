import { existsSync } from 'node:fs';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const config = loadConfig();
const app = await buildApp(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start');
  process.exit(1);
}
