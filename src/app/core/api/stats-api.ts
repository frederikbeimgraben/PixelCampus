import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from './api-config';
import { Leaderboard, LeaderboardMetric, PlayerProfile } from './models';

/** Reads player statistics from the pixelcampus-api service. */
@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  private get base(): string {
    return `${this.config.statsBaseUrl}/api/v1`;
  }

  /** Fetches one page of the leaderboard for `metric`. */
  leaderboard(metric: LeaderboardMetric, limit = 25, offset = 0): Observable<Leaderboard> {
    return this.http.get<Leaderboard>(`${this.base}/leaderboard`, {
      params: { metric, limit, offset },
    });
  }

  /** Fetches the full profile of one player by UUID or name. */
  player(idOrName: string): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`${this.base}/players/${encodeURIComponent(idOrName)}`);
  }

  /**
   * URL of a rendered skin.
   *
   * The API proxies and caches the render, so the browser never contacts a
   * third-party skin service and the connect-src policy stays narrow.
   */
  skinUrl(uuid: string, view: 'head' | 'body' = 'head', size = 128): string {
    return `${this.base}/players/${encodeURIComponent(uuid)}/skin/${view}?size=${size}`;
  }

  /** URL of the texture for a Minecraft item id such as `minecraft:diamond_sword`. */
  itemTextureUrl(id: string): string {
    const bare = id.replace(/^minecraft:/, '');
    return `/assets/items/${bare}.png`;
  }
}
