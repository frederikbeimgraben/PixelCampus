import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { API_CONFIG } from './api-config';
import {
  FormattedLine,
  FormattedSpan,
  MinecraftChatComponent,
  OFFLINE_STATUS,
  ServerStatus,
} from './models';

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
 * The sixteen named colors of Minecraft chat, as the game draws them.
 *
 * The names cannot go into CSS as they are. Half of them are no CSS color at
 * all, so `dark_red` was dropped and the text stayed the color it inherited.
 * The other half are CSS colors of the same name but another shade: CSS gold is
 * #ffd700 where the game draws #ffaa00.
 */
const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '#000000',
  dark_blue: '#0000aa',
  dark_green: '#00aa00',
  dark_aqua: '#00aaaa',
  dark_red: '#aa0000',
  dark_purple: '#aa00aa',
  gold: '#ffaa00',
  gray: '#aaaaaa',
  dark_gray: '#555555',
  blue: '#5555ff',
  green: '#55ff55',
  aqua: '#55ffff',
  red: '#ff5555',
  light_purple: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff',
};

/** A color a server states itself, such as the #ff0000 of a gradient. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Turns the color of a chat component into one CSS can draw.
 *
 * Exported for unit tests.
 *
 * @param color The color the component states, if it states one.
 * @param inherited The color of the parent, kept when this one states none.
 * @returns A CSS color.
 */
export function cssColor(color: string | undefined, inherited: string): string {
  if (color === undefined || color === '') return inherited;

  const named = NAMED_COLORS[color.toLowerCase()];
  if (named !== undefined) return named;

  // A server may state a color of its own. Anything else is not a color.
  return HEX_COLOR.test(color) ? color : inherited;
}

/** The color and style a child component keeps if it sets none of its own. */
interface InheritedStyle {
  readonly color: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

const ROOT_STYLE: InheritedStyle = { color: NAMED_COLORS['white'], bold: false, italic: false };

/**
 * Flattens a Minecraft chat component tree into display-ready lines.
 *
 * A component tree says nothing about lines. A MOTD holds up to two of them,
 * and the break between them is a newline in the text of a component. Each line
 * becomes one array of spans, which the banner puts on one row.
 *
 * Exported for unit tests.
 */
export function toFormattedLines(component: MinecraftChatComponent): FormattedLine[] {
  const lines: FormattedSpan[][] = [[]];

  const visit = (node: MinecraftChatComponent, inherited: InheritedStyle): void => {
    // A component that sets no color or style keeps the one of its parent.
    const style: InheritedStyle = {
      color: cssColor(node.color, inherited.color),
      bold: node.bold ?? inherited.bold,
      italic: node.italic ?? inherited.italic,
    };

    // The text of a component comes before the text of its children.
    if (node.text) {
      const parts = node.text.split('\n');

      for (const [index, part] of parts.entries()) {
        if (index > 0) {
          lines.push([]);
        }

        if (part) {
          lines[lines.length - 1].push({
            text: part,
            color: style.color,
            fontFamily: fontFamilyFor(style.bold, style.italic),
          });
        }
      }
    }

    for (const child of node.extra ?? []) {
      visit(child, style);
    }
  };

  visit(component, ROOT_STYLE);

  // A text that ends with a newline gives an empty line at the end. Nothing is
  // on it, so it only pushes the rest of the row up.
  while (lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }

  return lines;
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

  /**
   * URL of the server icon shown on the banner. Public prefix, not the base:
   * this goes into the markup for the browser to fetch.
   */
  readonly iconUrl = `${this.config.legacyPublicBase}/api/minecraft/icon.png`;

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
      description: toFormattedLines(status?.description ?? {}),
      playerCount: players?.online ?? 0,
      maxPlayerCount: players?.max ?? 0,
      players: (players?.sample ?? [])
        .map((player) => player.name)
        .filter((name): name is string => typeof name === 'string'),
      version: status?.version?.name ?? '???',
    };
  }
}
