import { Routes } from '@angular/router';

/**
 * Every page is loaded on demand, so opening the landing page no longer also
 * downloads the wiki renderer and the statistics tables.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'PixelCampus',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'wiki',
    title: 'Wiki | PixelCampus',
    loadComponent: () => import('./features/wiki/wiki').then((m) => m.Wiki),
  },
  {
    path: 'stats',
    title: 'Player Statistics | PixelCampus',
    loadComponent: () => import('./features/stats/leaderboard/leaderboard').then((m) => m.Leaderboard),
  },
  {
    path: 'stats/:player',
    title: 'Player | PixelCampus',
    loadComponent: () => import('./features/stats/player/player').then((m) => m.Player),
  },
  { path: '**', redirectTo: '' },
];
