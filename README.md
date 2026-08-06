# pixelcampus-api

Read-only HTTP API that fronts the **PLAN** (Player Analytics) and **ServerTap**
plugins for the [PixelCampus](https://pixelcampus.space) web front end.

## Why it exists

The browser must not talk to the plugins directly.

- ServerTap authenticates with a single key that also authorises console
  commands. A key that reaches a browser is a key that can stop the server.
- PLAN needs credentials and answers with dashboard-shaped JSON whose keys move
  between releases.
- The game server shares hardware with players. Without caching, a burst of page
  views becomes a burst of plugin queries.

This service holds the credentials, normalises both upstreams into one stable
shape, caches the result, and exposes only what the site renders. It has no
write endpoints.

## Endpoints

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/health`                         | Liveness, and which upstreams are configured |
| GET    | `/api/v1/server`                  | Name, version, player counts               |
| GET    | `/api/v1/leaderboard`             | Ranked players; `metric`, `limit`, `offset` |
| GET    | `/api/v1/players/:player`         | Profile by UUID or name: stats and gear    |
| GET    | `/api/v1/players/:uuid/skin/:view`| Proxied skin render; `view` is `head` or `body` |

`metric` is one of `playtime`, `kills`, `deaths`, `blocksMined`,
`blocksPlaced`, `distanceTravelled`.

Skin renders are proxied rather than linked. That keeps the site's
`connect-src` and `img-src` policies limited to one origin and stops the render
service learning which visitor looked at which player.

## Running

```sh
npm install
cp .env.example .env      # then fill in the upstream URLs and credentials
npm run dev               # tsx watch
npm run build && npm start
```

Configuration is read from the environment; see `.env.example` for every
setting. `.env` is gitignored.

Bind ServerTap and PLAN to `127.0.0.1` and let only this service reach them.

## Behaviour when an upstream is down

A missing or unreachable upstream is not an error:

- no ServerTap: `/api/v1/server` reports `online: false`, and profiles carry no
  gear, since gear is live state
- no PLAN: the leaderboard is empty and profiles show zeroed statistics
- both absent: the service still starts and `/health` says so

One dead plugin degrades a panel rather than taking the site down.

## Upstream compatibility

ServerTap and PLAN both change their payloads between releases. Every field is
parsed as optional and read through a list of candidate keys, so an unknown or
renamed key yields a zero or a null instead of failing the request. Adapters are
in `src/adapters/`; add new candidate keys there when an upstream moves.

## Development

```sh
npm test          # vitest
npm run typecheck
npm run lint
```

`buildApp()` is separate from the listener, so tests drive the routes through
`app.inject()` without binding a port.
