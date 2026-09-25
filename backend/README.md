# pixelcampus-api

Read-only HTTP API in front of the **PLAN** (Player Analytics) and **ServerTap**
plugins, for the [PixelCampus](https://pixelcampus.space) website.

## Why it exists

The browser must not talk to the plugins.

- The ServerTap key also authorizes console commands. A key that reaches a
  browser is a key that can stop the server.
- PLAN needs credentials. It answers with dashboard-shaped JSON whose keys move
  between releases.
- The game server shares hardware with players. Without a cache, a burst of page
  views becomes a burst of plugin queries.

This service holds the credentials. It turns both upstreams into one stable
shape, caches the result, and exposes only what the site renders. It has no
write endpoint.

## Endpoints

| Method | Path                               | Purpose                                      |
| ------ | ---------------------------------- | -------------------------------------------- |
| GET    | `/health`                          | Liveness, and which upstreams are configured |
| GET    | `/api/v1/server`                   | Name, version, player counts, MOTD, latency  |
| GET    | `/api/v1/server/icon.png`          | Server icon, from the ping. 404 if none      |
| GET    | `/api/v1/leaderboard`              | Ranked players. Takes `metric`, `limit`, `offset` |
| GET    | `/api/v1/players/:player`          | Profile by UUID or name: statistics and gear |
| GET    | `/api/v1/players/:uuid/skin/:view` | Proxied skin. `view` is `head`, `body` or `texture` |
| GET    | `/api/v1/live`                     | WebSocket. Server state and one watched player |

`metric` is one of `playtime`, `kills`, `deaths`, `blocksMined`,
`blocksPlaced`, `distanceTravelled`.

`shared/src` defines every shape. This service implements that contract and the
front end calls it, so neither side can drift.

`/api/v1/server` gives the MOTD twice. `motd` is plain text. `description` is
the chat component tree exactly as the ping returned it, with its colors and
styles, and the banner draws from it. `latencyMs` is the round trip of the
ping, and 0 when the server is offline.

The status and the icon come from one ping. It is kept for up to 15 seconds, so
a burst of page views costs the game server one ping. A failed ping is kept as
well, so a stopped server does not cost every page view a timeout.

Skin renders are proxied, not linked. This keeps `connect-src` and `img-src`
limited to one origin. It also stops the render service from learning which
visitor looked at which player.

## The live socket

A client connects to `/api/v1/live` and gets the server state. It can then send
one `watch` command to follow a player.

One timer serves every client, and it runs only while somebody listens. The game
server sees one query per distinct watched player, whatever the number of open
browsers. A client gets a value when it starts to watch, and after that only
when the value changes.

The latency does not count as a change. It moves on every ping, and counted, it
would send every client a message on every tick. The server state that is sent
carries the latency of the ping that changed something else.

Each tick pings the server again and does not use the 15-second copy. The
answer then replaces that copy, so the HTTP routes get it too.

The socket is read-only and unauthenticated, like the rest of the API. It caps
connections, limits the payload size, and drops a client that stops answering
the heartbeat.

## Running

```sh
npm install
cp .env.example .env      # then fill in the upstream URLs and credentials
npm run dev               # tsx watch
npm run build && npm start
```

The service reads its configuration from the environment. `.env.example` lists
every setting. `.env` is gitignored.

Bind ServerTap and PLAN to `127.0.0.1`. Let only this service reach them.

This service binds `127.0.0.1` as well. nginx proxies it at `/api/v1`, so it
needs no address of its own. A container needs `0.0.0.0`.

## Behavior when an upstream is down

A missing or unreachable upstream is not an error.

- Without ServerTap, `/api/v1/server` reports `online: false`. Profiles carry no
  live gear, and fall back to the last reading.
- Without PLAN, the leaderboard is empty and profiles show zeroed statistics.
- Without either, the service still starts and `/health` says so.

One dead plugin degrades one panel. It does not stop the site.

## Upstream compatibility

ServerTap and PLAN both change their payloads between releases. Every field is
optional, and the adapters read each value through a list of candidate keys. An
unknown or renamed key gives a zero or a null instead of a failed request.

The adapters are in `src/adapters/`. Add new candidate keys there when an
upstream moves.

## Development

```sh
npm run lint
npm run typecheck
npm test          # vitest
```

`buildApp()` is separate from the listener, so the tests drive the routes
through `app.inject()` without binding a port. The socket tests bind a port,
because `inject()` cannot upgrade a connection.
