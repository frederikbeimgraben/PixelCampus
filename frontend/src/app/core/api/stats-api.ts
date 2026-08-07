import { Injectable, inject } from '@angular/core';
import {
  API_BASE_PATH,
  type Leaderboard,
  type LeaderboardMetric,
  type PlayerProfile,
} from '@pixelcampus/contract';
import { Observable, from } from 'rxjs';

import { API_CONFIG } from './api-config';
import { API_CLIENT } from './client';

/**
 * Reads player statistics.
 *
 * The calls go through the contract client, so the arguments and the returned
 * shapes are the ones the API declares; there are no URLs or response types
 * written out here to drift from it.
 */
@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly client = inject(API_CLIENT);
  private readonly config = inject(API_CONFIG);

  /** Fetches one page of the leaderboard for `metric`. */
  leaderboard(metric: LeaderboardMetric, limit = 25, offset = 0): Observable<Leaderboard> {
    return from(this.client.leaderboard({ metric, limit, offset }));
  }

  /** Fetches the full profile of one player by UUID or name. */
  player(idOrName: string): Observable<PlayerProfile> {
    return from(this.client.player({ player: idOrName }));
  }

  /**
   * URL of a rendered skin.
   *
   * Not part of the contract: these are binary responses with their own
   * caching, so the URL is built here.
   *
   * `texture` returns the raw 64x64 skin, which the 3D viewer needs; the other
   * views are flat renders.
   */
  skinUrl(uuid: string, view: 'head' | 'body' | 'texture' = 'head', size = 128): string {
    return `${this.config.statsBaseUrl}${API_BASE_PATH}/players/${encodeURIComponent(uuid)}/skin/${view}?size=${size}`;
  }

  /** URL of the texture for a Minecraft item id such as `minecraft:diamond_sword`. */
  itemTextureUrl(id: string): string {
    const bare = id.replace(/^minecraft:/, '');
    return `/assets/items/${bare}.png`;
  }
}
