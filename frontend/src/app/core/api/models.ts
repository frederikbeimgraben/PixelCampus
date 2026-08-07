/**
 * Types the front end uses.
 *
 * The wire shapes come from the shared contract, so this app and the API cannot
 * disagree about them. Only the types with no wire presence are declared here.
 */
export type {
  GearItem,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardMetric,
  PlayerGear,
  PlayerProfile,
  PlayerStats,
  ServerInfo,
} from '@pixelcampus/contract';

/** One run of colour/style formatting inside a Minecraft chat component. */
export interface FormattedSpan {
  readonly text: string;
  readonly color: string;
  readonly fontFamily: string;
}

/** Raw Minecraft chat component, as sent in a server list ping. */
export interface MinecraftChatComponent {
  readonly text?: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly extra?: readonly MinecraftChatComponent[];
}

/** Normalised server list ping result, used by the landing page banner. */
export interface ServerStatus {
  readonly online: boolean;
  readonly latencyMs: number;
  readonly description: readonly FormattedSpan[];
  readonly playerCount: number;
  readonly maxPlayerCount: number;
  readonly players: readonly string[];
  readonly version: string;
}

/** Server status shown before the first response arrives. */
export const OFFLINE_STATUS: ServerStatus = {
  online: false,
  latencyMs: 0,
  description: [],
  playerCount: 0,
  maxPlayerCount: 0,
  players: [],
  version: '',
};
