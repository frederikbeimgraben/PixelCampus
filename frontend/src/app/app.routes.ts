import { Routes } from '@angular/router';

/** Every page is loaded on demand. */
export const routes: Routes = [
  {
    path: '',
    title: 'PixelCampus',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'stats',
    title: 'Player Statistics | PixelCampus',
    loadComponent: () =>
      import('./features/stats/leaderboard/leaderboard').then((m) => m.Leaderboard),
  },
  {
    path: 'stats/:player',
    title: 'Player | PixelCampus',
    loadComponent: () => import('./features/stats/player/player').then((m) => m.Player),
  },
  {
    path: 'wiki',
    title: 'Wiki | PixelCampus',
    loadComponent: () => import('./features/wiki/wiki-index/wiki-index').then((m) => m.WikiIndex),
  },
  {
    path: 'wiki/:page',
    title: 'Wiki | PixelCampus',
    loadComponent: () => import('./features/wiki/wiki-page/wiki-page').then((m) => m.WikiPage),
  },
  { path: '**', redirectTo: '' },
];
