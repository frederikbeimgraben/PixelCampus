# PixelCampus

Website and API for the PixelCampus Minecraft server. The server belongs to the
computer science faculty of Reutlingen University.

| Directory   | What it is                                                               |
| ----------- | ------------------------------------------------------------------------ |
| `shared/`   | The API contract. Both halves compile it.                                |
| `backend/`  | Fastify service in front of the PLAN and ServerTap plugins               |
| `frontend/` | Angular 22 app: landing page and player statistics, rendered per request |

Each package has its own `README.md`, `package.json` and `.env.example`.

## Getting started

```sh
# Front end on http://localhost:4200
cd frontend && npm install && cp .env.example .env && npm start

# API on http://localhost:8080
cd backend && npm install && cp .env.example .env && npm run dev
```

The app calls both APIs under `/api` on its own origin. In production nginx
serves the site and proxies those paths. In development `ng serve` proxies them,
through `frontend/proxy.conf.mjs`. If the API is not on `127.0.0.1:8080`, set
`PC_DEV_API_TARGET` in `frontend/.env`.

## Rendering

A Node process renders every page before it is sent. `ng serve` does this in
development. The process built from `frontend/src/server.ts` does it in
production.

To see the deployed setup, run `nix run .#preview`. It puts the renderer behind
the nginx configuration the site ships with. This is the only way to exercise
the caching rules and the nonce-based policy.

## Layout

```
shared/src/            zod schemas, the oRPC contract, the socket protocol

backend/
  src/adapters/        PLAN, ServerTap and skin-render clients
  src/domain/          statistics, the gear cache, the live hub
  src/routes/          HTTP endpoints and the WebSocket

frontend/
  src/server.ts        the rendering server
  src/app/core/        API clients, i18n, viewport, sound, asset loading
  src/app/ui/          Minecraft-styled presentational components
  src/app/features/    landing, stats
  public/assets/       textures, fonts, sprites
  scripts/             env generation, Minecraft texture refresh
  deploy/              nginx server-block config
  e2e/                 Playwright tests
```

## Checks

Run these from the repository root:

```sh
npm run lint
npm run typecheck
npm run test
npm run format:check
```

Two more need their own command:

```sh
cd frontend && npm run test:e2e   # Playwright, in Chromium and mobile Chrome
nix flake check                   # builds both packages, parses the nginx config
```

GitHub Actions runs all of them on every push and pull request.

## The API contract

`shared/src` holds the zod schemas and the oRPC contract. It is the only place
these shapes are written. The back end implements the contract and the front end
calls it, so a path, its inputs and its response cannot drift apart. A change on
one side fails to compile on the other.

`shared/src/live.ts` describes the WebSocket at `/api/v1/live` the same way. It
is not part of the oRPC contract, which covers request and response endpoints.
Its messages are the same zod schemas on both sides.

The API reads the game server once per interval, for as long as somebody
listens, and pushes only what changed. Player counts and presence follow the
server, and no open tab polls it.

`scripts/sync-contract.mjs` copies these sources into `backend/src/contract` and
`frontend/src/contract` before either package builds. The copies are generated
and gitignored. Edit `shared/src`.

The copies exist because the contract imports zod. TypeScript and esbuild both
resolve an import by walking up from the importing file. A directory outside
either package has no `node_modules` to find.

## Maintenance

Item and block textures come from the official Minecraft client jar.
`frontend/minecraft-version.json` pins the release they came from, so the script
reproduces what is already in the repository:

```sh
cd frontend && npm run update:assets                # the pinned release
cd frontend && npm run update:assets -- --dry-run   # what would change
cd frontend && npm run update:assets -- --latest    # move to a new release
```

`--latest` rewrites the pin. The new version then appears in the diff beside the
textures it explains.

The textures are Mojang's. They are used here for a fan site for one server.
Check the Minecraft EULA before you redistribute them.
