/**
 * Stand-in for the old API, for local development only.
 *
 * The site still reads the server status and the server icon from an older
 * service at /api/minecraft. That service is not part of this repository, and
 * it answers for the real server. This process answers the same two paths for
 * the Minecraft server in dev/docker-compose.yml.
 *
 * It reads the server the way a game client does, with a server list ping. The
 * status it returns therefore holds the real description tree, the real player
 * sample and a real latency, which is what the banner draws.
 *
 * Usage: node dev/legacy-api.mjs
 */

import { createServer } from 'node:http';
import { Socket } from 'node:net';

const PORT = Number(process.env['PORT'] ?? 8091);
const MC_HOST = process.env['MC_HOST'] ?? '127.0.0.1';
const MC_PORT = Number(process.env['MC_PORT'] ?? 25565);

/** A ping costs a TCP round trip. Page views come in bursts. */
const CACHE_MS = 2000;

const PROTOCOL_VERSION = 767;
const PING_TIMEOUT_MS = 3000;

/* --- The server list ping ------------------------------------------------ */

function varInt(value) {
  const bytes = [];
  let rest = value | 0;

  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest !== 0);

  return Buffer.from(bytes);
}

function readVarInt(buffer, offset) {
  let value = 0;
  let shift = 0;

  for (let i = 0; i < 5; i += 1) {
    if (offset + i >= buffer.length) return null;

    const byte = buffer[offset + i];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, size: i + 1 };
    shift += 7;
  }

  throw new Error('varint is longer than five bytes');
}

function packet(id, ...parts) {
  const body = Buffer.concat([varInt(id), ...parts]);
  return Buffer.concat([varInt(body.length), body]);
}

function mcString(text) {
  const bytes = Buffer.from(text, 'utf8');
  return Buffer.concat([varInt(bytes.length), bytes]);
}

/**
 * @returns The status JSON and the round trip in milliseconds, or null when the
 *   server does not answer.
 */
function ping(host, port) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const started = process.hrtime.bigint();
    let received = Buffer.alloc(0);
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PING_TIMEOUT_MS);
    socket.on('timeout', () => finish(null));
    socket.on('error', () => finish(null));
    socket.on('close', () => finish(null));

    socket.connect(port, host, () => {
      const handshake = packet(
        0x00,
        varInt(PROTOCOL_VERSION),
        mcString(host),
        Buffer.from([port >> 8, port & 0xff]),
        varInt(1), // next state: status
      );
      socket.write(Buffer.concat([handshake, packet(0x00)]));
    });

    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);

      const frame = readVarInt(received, 0);
      if (frame === null) return;
      if (received.length < frame.size + frame.value) return;

      const id = readVarInt(received, frame.size);
      const length = readVarInt(received, frame.size + id.size);
      const start = frame.size + id.size + length.size;
      if (received.length < start + length.value) return;

      const latencyMs = Number((process.hrtime.bigint() - started) / 1000000n);

      try {
        const status = JSON.parse(received.subarray(start, start + length.value).toString('utf8'));
        finish({ status, latencyMs: Math.max(1, latencyMs) });
      } catch {
        finish(null);
      }
    });
  });
}

/* --- The two paths the site asks for ------------------------------------- */

let cached = null;

async function status() {
  const now = Date.now();
  if (cached !== null && now - cached.at < CACHE_MS) return cached.value;

  const result = await ping(MC_HOST, MC_PORT);
  const value = result ?? { status: {}, latencyMs: 0 };

  cached = { at: now, value };
  return value;
}

/** The ping carries the icon as a data URI. Give it back as an image. */
function iconFrom(favicon) {
  if (typeof favicon !== 'string') return null;

  const comma = favicon.indexOf(',');
  if (!favicon.startsWith('data:image/png;base64,') || comma < 0) return null;

  return Buffer.from(favicon.slice(comma + 1), 'base64');
}

const server = createServer((request, response) => {
  const path = (request.url ?? '').split('?')[0];

  if (path === '/api/minecraft/status') {
    void status().then(({ status: raw, latencyMs }) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { latency: latencyMs, status: raw } }));
    });
    return;
  }

  if (path === '/api/minecraft/icon.png') {
    void status().then(({ status: raw }) => {
      const icon = iconFrom(raw.favicon);

      // 404, not a placeholder. The site has its own fallback, and this is
      // where that fallback has to prove it works.
      if (icon === null) {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(icon);
    });
    return;
  }

  response.writeHead(404).end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`legacy stand-in on http://127.0.0.1:${PORT} for ${MC_HOST}:${MC_PORT}`);
});
