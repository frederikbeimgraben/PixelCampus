import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { API_CONFIG } from './api-config';
import { FormattedSpan, MinecraftChatComponent, OFFLINE_STATUS, ServerStatus } from './models';

/** Raw envelope returned by `/api/minecraft/status`. */
interface StatusEnvelope {
  data?: {
    latency?: number;
    status?: {
      description?: MinecraftChatComponent;
      players?: { online?: number; max?: number; sample?: { name?: string }[] };
      version?: { name?: string };
    };
  };
}

/**
 * Flattens a Minecraft chat component tree into display-ready spans.
 *
 * Exported for unit tests; the original implementation was a class that mixed
 * parsing with an untyped index signature.
 */
export function toFormattedSpans(component: MinecraftChatComponent): FormattedSpan[] {
  const spans: FormattedSpan[] = [];

  const visit = (node: MinecraftChatComponent): void => {
    for (const child of node.extra ?? []) {
      visit(child);
    }

    if (!node.text) {
      return;
    }

    spans.push({
      text: node.text,
      color: node.color ?? 'white',
      fontFamily: fontFamilyFor(node.bold === true, node.italic === true),
    });
  };

  visit(component);
  return spans;
}

function fontFamilyFor(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'Minecraft Bold Italic';
  if (bold) return 'Minecraft Bold';
  if (italic) return 'Minecraft Italic';
  return 'Minecraft Regular';
}

/** Reads the live status of the Minecraft server. */
@Injectable({ providedIn: 'root' })
export class ServerStatusApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  /** URL of the server icon shown on the banner. */
  readonly iconUrl = `${this.config.legacyBaseUrl}/api/minecraft/icon.png`;

  /**
   * Fetches the current server status. A failed request resolves to
   * {@link OFFLINE_STATUS} rather than raising, because the banner has to render
   * either way.
   */
  fetch(): Observable<ServerStatus> {
    return this.http.get<StatusEnvelope>(`${this.config.legacyBaseUrl}/api/minecraft/status`).pipe(
      map((envelope) => this.normalise(envelope)),
      catchError(() => of(OFFLINE_STATUS)),
    );
  }

  private normalise(envelope: StatusEnvelope): ServerStatus {
    const status = envelope.data?.status;
    const players = status?.players;
    const latencyMs = envelope.data?.latency ?? 0;

    return {
      online: latencyMs > 0,
      latencyMs,
      description: toFormattedSpans(status?.description ?? {}),
      playerCount: players?.online ?? 0,
      maxPlayerCount: players?.max ?? 0,
      players: (players?.sample ?? [])
        .map((player) => player.name)
        .filter((name): name is string => typeof name === 'string'),
      version: status?.version?.name ?? '???',
    };
  }
}
