import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Player {
  id: string;
  nickname: string;
  characterId: string | null;
  isAlive: boolean;
  isHost: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: Record<string, Player>;
  phase: string;
  round: number;
  selectedCharacters: string[];
  dayDurationSeconds: number;
  nightDurationSeconds: number;
  winner: 'good' | 'evil' | 'neutral' | null;
  winnerPlayerId: string | null;
  phaseDeadline: number | null;
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  team: 'good' | 'evil' | 'neutral';
  hasNightAction: boolean;
  nightActionDescription?: string;
  icon: string;
  maxCount?: number;
}

interface GameState {
  room: Room | null;
  playerId: string | null;
  myCharacterId: string | null;
  allies: { id: string; nickname: string; characterId: string | null }[];
  characters: CharacterDef[];
  detectiveResult: string | null;
  setRoom: (r: Room | null | ((prev: Room | null) => Room | null)) => void;
  setPlayerId: (id: string | null) => void;
  setMyCharacterId: (id: string | null) => void;
  setAllies: (a: { id: string; nickname: string; characterId: string | null }[]) => void;
  setCharacters: (c: CharacterDef[]) => void;
  setDetectiveResult: (r: string | null) => void;
}

const GameContext = createContext<GameState>({} as GameState);

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [myCharacterId, setMyCharacterId] = useState<string | null>(null);
  const [allies, setAllies] = useState<{ id: string; nickname: string; characterId: string | null }[]>([]);
  const [characters, setCharacters] = useState<CharacterDef[]>([]);
  const [detectiveResult, setDetectiveResult] = useState<string | null>(null);

  return (
    <GameContext.Provider
      value={{
        room, setRoom,
        playerId, setPlayerId,
        myCharacterId, setMyCharacterId,
        allies, setAllies,
        characters, setCharacters,
        detectiveResult, setDetectiveResult,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
