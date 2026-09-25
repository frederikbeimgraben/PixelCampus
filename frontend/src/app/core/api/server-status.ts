import { Injectable, Injector, inject } from '@angular/core';
import { pendingUntilEvent } from '@angular/core/rxjs-interop';
import { API_BASE_PATH } from '@pixelcampus/contract';
import { Observable, catchError, from, map, of } from 'rxjs';

import { API_CONFIG } from './api-config';
import { API_CLIENT } from './client';
import {
  FormattedLine,
  FormattedSpan,
  MinecraftChatComponent,
  OFFLINE_STATUS,
  ServerInfo,
  ServerStatus,
} from './models';

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

/**
 * Reads a MOTD as the ping returned it into one component tree.
 *
 * The API passes the description on untouched, and a server may send a tree, a
 * bare string or an array of either. A string keeps any `§` codes in it as
 * text: servers on this version of the game send a tree.
 *
 * Exported for unit tests.
 *
 * @param description The `description` of the server information.
 * @returns A tree {@link toFormattedLines} can read. Empty for anything else.
 */
export function toComponent(description: unknown): MinecraftChatComponent {
  if (typeof description === 'string') return { text: description };
  if (Array.isArray(description)) return { extra: description.map(toComponent) };
  if (typeof description === 'object' && description !== null) {
    return description as MinecraftChatComponent;
  }
  return {};
}

/**
 * Turns the server information of the API into what the banner shows.
 *
 * Exported for unit tests.
 */
export function toServerStatus(info: ServerInfo): ServerStatus {
  // The banner reads a latency of 0 as offline, so an offline server has none.
  const latencyMs = info.online ? (info.latencyMs ?? 0) : 0;

  return {
    online: info.online && latencyMs > 0,
    latencyMs,
    description: toFormattedLines(toComponent(info.description)),
    playerCount: info.playerCount,
    maxPlayerCount: info.maxPlayerCount,
    players: info.players,
    version: info.version === 'unknown' ? '???' : info.version,
  };
}

/** Reads the live status of the Minecraft server. */
@Injectable({ providedIn: 'root' })
export class ServerStatusApi {
  private readonly client = inject(API_CLIENT);
  private readonly config = inject(API_CONFIG);
  private readonly injector = inject(Injector);

  /**
   * URL of the server icon shown on the banner. Public prefix, not the base:
   * this goes into the markup for the browser to fetch. Not part of the
   * contract, because it is a binary response, like the skin images.
   */
  readonly iconUrl = `${this.config.statsPublicBase}${API_BASE_PATH}/server/icon.png`;

  /**
   * Fetches the current server status. A failed request resolves to
   * {@link OFFLINE_STATUS} rather than raising, because the banner has to render
   * either way.
   */
  fetch(): Observable<ServerStatus> {
    return from(this.client.server()).pipe(
      map(toServerStatus),
      catchError(() => of(OFFLINE_STATUS)),
      // The contract client is a bare promise, which the renderer does not
      // wait for. Without this the landing page is sent with the server shown
      // as offline, before the answer arrives.
      pendingUntilEvent(this.injector),
    );
  }
}
