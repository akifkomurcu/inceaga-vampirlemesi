import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useGame } from '../contexts/GameContext';
import type { Room } from '../contexts/GameContext';
import {
  clearLobbySession,
  readLobbySession,
  saveLobbySession,
} from '../utils/lobbySession';

/**
 * Invisible component that wires up all global socket events.
 * Mounted once inside BrowserRouter so it can use useNavigate.
 */
export default function AppEvents() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const {
    setRoom, setPlayerId, setMyCharacterId, setAllies,
    setCharacters, setDetectiveResult,
  } = useGame();

  useEffect(() => {
    if (!socket) return;

    const persistLobbySession = (room: Room, playerId: string) => {
      const me = room.players[playerId];
      if (!me || room.phase !== 'lobby') return;
      saveLobbySession({ code: room.code, nickname: me.nickname });
    };

    type Handler = (data: any) => void;
    const handlers: [string, Handler][] = [
      ['room-created', ({ room, playerId }: { room: Room; playerId: string }) => {
        persistLobbySession(room, playerId);
        setRoom(room);
        setPlayerId(playerId);
        navigate('/lobby');
      }],
      ['room-joined', ({ room, playerId }: { room: Room; playerId: string }) => {
        persistLobbySession(room, playerId);
        setRoom(room);
        setPlayerId(playerId);
        navigate('/lobby');
      }],
      ['room-state', ({ room, playerId }: { room: Room; playerId?: string }) => {
        const restoredPlayerId = playerId ?? Object.values(room.players).find(
          (player) => player.nickname === readLobbySession()?.nickname,
        )?.id;

        if (restoredPlayerId) {
          persistLobbySession(room, restoredPlayerId);
          setPlayerId(restoredPlayerId);
        }

        setRoom(room);
        if (room.phase === 'lobby') {
          navigate('/lobby');
        }
      }],
      ['player-joined', ({ players, hostId }: { players: Record<string, any>; hostId?: string }) => {
        setRoom((prev) => prev ? { ...prev, players, hostId: hostId ?? prev.hostId } : prev);
      }],
      ['player-left', ({ players, hostId }: { players: Record<string, any>; hostId: string }) => {
        setRoom((prev) => prev ? { ...prev, players, hostId } : prev);
      }],
      ['settings-updated', ({ room }: { room: Room }) => {
        setRoom(room);
      }],
      ['game-started', ({ room }: { room: Room }) => {
        clearLobbySession();
        setRoom(room);
        navigate('/role-reveal');
      }],
      ['role-assigned', ({ characterId, allies }: { characterId: string; allies: any[] }) => {
        setMyCharacterId(characterId);
        setAllies(allies);
      }],
      ['phase-change', ({ phase, deadline, round }: { phase: string; deadline: number; round?: number }) => {
        setRoom((prev) => prev ? { ...prev, phase, phaseDeadline: deadline, round: round ?? prev.round } : prev);
        if (phase === 'day_discussion') navigate('/game/day');
        else if (phase === 'night') navigate('/game/night');
      }],
      ['vote-resolved', ({ players, phase, winner, winnerPlayerId }: any) => {
        setRoom((prev) => prev ? { ...prev, players, phase, winner, winnerPlayerId: winnerPlayerId || null } : prev);
      }],
      ['morning', ({ players, phase }: any) => {
        setRoom((prev) => prev ? { ...prev, players, phase } : prev);
        navigate('/game/morning');
      }],
      ['detective-result', ({ result }: { result: string }) => {
        setDetectiveResult(result);
      }],
      ['game-over', ({ winner, players, winnerPlayerId }: any) => {
        clearLobbySession();
        setRoom((prev) => prev ? { ...prev, winner, players, winnerPlayerId: winnerPlayerId || null, phase: 'game_over' } : prev);
        navigate('/game/over');
      }],
      ['characters-list', (data: any) => {
        setCharacters(data);
      }],
      ['error', ({ message }: { message: string }) => {
        if (
          message.includes('Oda bulunamadı')
          || message.includes('Oyuncu bulunamadı')
          || message.includes('yeniden bağlanma')
        ) {
          clearLobbySession();
        }
        console.warn('Socket error:', message);
      }],
    ];

    handlers.forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [socket, navigate, setRoom, setPlayerId, setMyCharacterId, setAllies, setCharacters, setDetectiveResult]);

  return null;
}
