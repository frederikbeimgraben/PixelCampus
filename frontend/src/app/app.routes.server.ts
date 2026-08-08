import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Every route is rendered per request.
 *
 * Prerendering is the cheaper default, but nothing here is static. The landing
 * page shows who is on the server now. `/stats/:player` has one page per
 * player, and the build does not know that list.
 *
 * A render per request also needs no API at build time. The Nix sandbox gives
 * the build no network anyway.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
