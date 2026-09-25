# pixelcampus-frontend

The PixelCampus website. Angular 22, zoneless and signal-based, rendered on the
server and hydrated in the browser.

The interface copies the Minecraft server list. The landing page is a list of
entries, and the statistics pages use the game's panels, slots and HUD sprites.

## Running

```sh
npm install
cp .env.example .env
npm start           # http://localhost:4200
```

`ng serve` renders pages the same way production does. It also proxies `/api/v1`
to the API, through `proxy.conf.mjs`. Start the API first, or point
`PC_DEV_API_TARGET` at another address.

## Configuration

Angular compiles ahead of time, so `.env` is read at **build** time.
`scripts/generate-env.mjs` turns it into a typed module before `ng` runs. Every
value reaches the JavaScript bundle the browser downloads. Put no secret there.

Rebuild after you change `.env`. `.env.example` lists every setting.

Two settings are read when a process starts, not compiled in. `.env.example`
marks them. One aims the dev-server proxy. One tells the renderer where the API
is.

## Rendering

`src/server.ts` is the entry point. It serves `browser/` as a fallback and
renders every other request.

In production nginx serves `browser/` from disk and sends only document requests
to this process. nginx also mints a Content-Security-Policy nonce per request
and passes it in `X-CSP-Nonce`. The renderer stamps that nonce on the inline
blocks it writes.

`app.config.server.ts` holds what the renderer must not share with the browser:

- it dials the API directly, because it has no origin of its own
- it reads the translations from disk, not over HTTP
- it picks the language from the `Accept-Language` header

To run the built renderer behind the real nginx configuration, use
`nix run .#preview` from the repository root.

## Assets

`public/assets/` holds textures from the Minecraft client jar, the Minecraft
faces, and the GUI sprites. The root `README.md` explains how to refresh them.

`AssetLoader` fetches the GUI sprites and the faces at start-up and reports the
progress. The loading screen stays up until they arrive, so the visitor sees one
finished frame instead of an unfinished one that corrects itself.

## Checks

```sh
npm run lint
npm test            # vitest, through the Angular unit-test builder
npm run build
npm run test:e2e    # Playwright, in Chromium and mobile Chrome
```

`@playwright/test` is pinned to an exact version. The browsers must match it.
NixOS cannot run the browsers Playwright downloads. Use the dev shell, which
sets `PLAYWRIGHT_BROWSERS_PATH`.

The end-to-end tests intercept every upstream call, including the WebSocket.
They depend on no running server. `e2e/no-script.spec.ts` runs the landing page
with scripting off.
