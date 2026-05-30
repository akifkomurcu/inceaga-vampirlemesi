export interface Player {
  id: string; // socket id
  nickname: string;
  characterId: string | null;
  isAlive: boolean;
  isHost: boolean;
  connectedAt: number;
  // Witch specific
  hasKillPotion?: boolean;
  hasSavePotion?: boolean;
  // Hunter specific
  hasShot?: boolean;
}

export type GamePhase =
  | 'lobby'
  | 'role_reveal'
  | 'day_discussion'
  | 'day_vote'
  | 'night'
  | 'morning'
  | 'game_over';

export interface NightActions {
  vampireTarget: string | null;    // player id
  doctorTarget: string | null;     // player id
  detectiveTarget: string | null;  // player id
  witchKillTarget: string | null;  // player id
  witchSaveTarget: string | null;  // player id
  // which players submitted night action
  submitted: string[];
}

export interface VoteState {
  votes: Record<string, string>; // voterId -> targetId
  deadline: number; // timestamp ms
}

export interface Room {
  code: string;
  hostId: string;
  players: Record<string, Player>;
  phase: GamePhase;
  round: number;
  // Lobby settings
  selectedCharacters: string[]; // character ids in pool (may repeat for vampires etc)
  dayDurationSeconds: number;
  nightDurationSeconds: number;
  // Game state
  votes: VoteState | null;
  nightActions: NightActions;
  eliminatedThisRound: string[];
  winner: 'good' | 'evil' | 'neutral' | null;
  winnerPlayerId: string | null; // for jester
  phaseDeadline: number | null; // timestamp ms
  // Detective results
  detectiveResults: Record<string, string>; // detectiveId -> result text (only sent to detective)
}
