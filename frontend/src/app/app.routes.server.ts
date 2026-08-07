import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Every route is rendered per request.
 *
 * Prerendering is the cheaper default, but nothing here is static: the landing
 * page shows who is on the server right now, and `/stats/:player` has one page
 * per player, which is not a list the build knows. Rendering on request also
 * means the build needs no API to talk to, which the Nix sandbox does not give
 * it anyway.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
