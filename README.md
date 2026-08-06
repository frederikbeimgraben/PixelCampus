# PixelCampus

Website and API for the PixelCampus Minecraft server of the Reutlingen
University computer science faculty.

| Directory   | What it is                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `frontend/` | Angular 22 single-page app: landing page, wiki, player statistics           |
| `backend/`  | Fastify service fronting the PLAN and ServerTap plugins                     |

Each half has its own README, `package.json` and `.env.example`.

## Getting started

```sh
# Front end on http://localhost:4200
cd frontend && npm install && cp .env.example .env && npm start

# API on http://localhost:8080
cd backend && npm install && cp .env.example .env && npm run dev
```

Point `PC_STATS_API_URL` in `frontend/.env` at the API when running both.

## Layout

```
frontend/
  src/app/core/        HTTP services, viewport, sound, asset preloading
  src/app/ui/          Minecraft-styled presentational components
  src/app/features/    landing, wiki (with its parser), stats
  public/assets/       textures, fonts, sprites
  scripts/             env generation, Minecraft texture refresh
  deploy/              nginx security headers
  e2e/                 Playwright tests

backend/
  src/adapters/        PLAN, ServerTap and skin-render clients
  src/domain/          shared models, statistics aggregation
  src/routes/          HTTP endpoints
```

## Checks

```sh
cd frontend && npm run lint && npm test && npm run build
cd frontend && npm run test:e2e

cd backend && npm run lint && npm run typecheck && npm test
```

## Maintenance

Item and block textures come from the official client jar:

```sh
cd frontend && npm run update:assets            # latest release
cd frontend && npm run update:assets -- --version=26.2 --dry-run
```

The textures are Mojang's, used here for a fan site for one server. Check the
Minecraft EULA before redistributing them.
