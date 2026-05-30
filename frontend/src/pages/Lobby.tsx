import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import type { CharacterDef } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useError } from '../hooks/useError';
import ErrorToast from '../components/ErrorToast';
import GameShell from '../components/GameShell';

const TEAM_LABELS: Record<string, string> = { good: 'İyi', evil: 'Kötü', neutral: 'Nötr' };
const TEAM_CLASS: Record<string, string> = { good: 'team-good', evil: 'team-evil', neutral: 'team-neutral' };

const PLAYER_CAPACITY = 20;
const DAY_STEP_SECONDS = 60;
const NIGHT_STEP_SECONDS = 10;
const MIN_DAY_SECONDS = 60;
const MAX_DAY_SECONDS = 600;
const MIN_NIGHT_SECONDS = 20;
const MAX_NIGHT_SECONDS = 180;

type LobbyFeedItem =
  | { id: string; type: 'system'; message: string; timestamp: number }
  | {
      id: string;
      type: 'chat';
      message: string;
      nickname: string;
      self: boolean;
      timestamp: number;
    };

interface ChatMessagePayload {
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export default function Lobby() {
  const { room, playerId, characters } = useGame();
  const { socket, connected } = useSocket();
  const { error, showError } = useError();
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [feed, setFeed] = useState<LobbyFeedItem[]>([]);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const previousRoomRef = useRef<string | null>(null);
  const previousPlayersRef = useRef<Record<string, string>>({});

  if (!room) return null;

  const myPlayer = playerId ? room.players[playerId] : null;
  const isHost = room.hostId === playerId;
  const players = useMemo(
    () =>
      Object.values(room.players).sort((left, right) => {
        const leftScore = Number(left.id === playerId) * 2 + Number(left.isHost);
        const rightScore = Number(right.id === playerId) * 2 + Number(right.isHost);
        if (leftScore !== rightScore) return rightScore - leftScore;
        return left.nickname.localeCompare(right.nickname, 'tr');
      }),
    [room.players, playerId],
  );

  // Karakter havuzu: her karakter id'si kaç kez seçildi
  const charCounts: Record<string, number> = {};
  room.selectedCharacters.forEach((id) => {
    charCounts[id] = (charCounts[id] || 0) + 1;
  });

  const totalSelected = room.selectedCharacters.length;
  const playerCount = players.length;
  const mismatch = totalSelected !== playerCount;
  const canStart = !mismatch && playerCount >= 4;
  const vampireCount = charCounts.vampire || 0;
  const maxVampires = Math.max(1, Math.min(6, playerCount || 6));
  const lobbyStatus = canStart
    ? 'Hazır'
    : playerCount < 4
      ? 'Toplanıyor'
      : 'Ayar Bekliyor';
  const lobbyStatusDetail = `${lobbyStatus} (${playerCount}/${PLAYER_CAPACITY})`;
  const visibleSlots = Math.min(Math.max(playerCount + 1, 4), 8);
  const fillerCount = Math.max(0, visibleSlots - playerCount);
  const feedPlaceholder = connected ? 'Fısılda...' : 'Bağlantı bekleniyor...';

  useEffect(() => {
    const currentPlayers = Object.fromEntries(
      Object.values(room.players).map((player) => [player.id, player.nickname]),
    );

    if (previousRoomRef.current !== room.code) {
      previousRoomRef.current = room.code;
      previousPlayersRef.current = currentPlayers;
      setFeed([
        {
          id: `system-${room.code}`,
          type: 'system',
          message: isHost
            ? 'Lobi oluşturuldu. Ayin için katılımcıları bekliyorsun.'
            : `${room.code} odasına katıldın.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const previousPlayers = previousPlayersRef.current;
    const nextFeedItems: LobbyFeedItem[] = [];

    for (const [id, nickname] of Object.entries(currentPlayers)) {
      if (!(id in previousPlayers)) {
        nextFeedItems.push({
          id: `join-${id}-${Date.now()}`,
          type: 'system',
          message: `${nickname} köy meydanına geldi.`,
          timestamp: Date.now(),
        });
      }
    }

    for (const [id, nickname] of Object.entries(previousPlayers)) {
      if (!(id in currentPlayers)) {
        nextFeedItems.push({
          id: `leave-${id}-${Date.now()}`,
          type: 'system',
          message: `${nickname} sessizce ayrıldı.`,
          timestamp: Date.now(),
        });
      }
    }

    if (nextFeedItems.length > 0) {
      setFeed((currentFeed) => [...currentFeed.slice(-29), ...nextFeedItems]);
    }

    previousPlayersRef.current = currentPlayers;
  }, [room, isHost]);

  useEffect(() => {
    if (!socket || room.phase !== 'lobby') return;

    const onChat = (data: ChatMessagePayload) => {
      setFeed((currentFeed) => [
        ...currentFeed.slice(-29),
        {
          id: `chat-${data.timestamp}-${data.playerId}`,
          type: 'chat',
          message: data.message,
          nickname: data.nickname,
          self: data.playerId === playerId,
          timestamp: data.timestamp,
        },
      ]);
    };

    socket.on('chat-message', onChat);
    return () => {
      socket.off('chat-message', onChat);
    };
  }, [socket, room.phase, playerId]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateChar = (charId: string, delta: number) => {
    if (!isHost) return;
    const current = charCounts[charId] || 0;
    const next = current + delta;
    if (next < 0) return;
    const charDef = characters.find((c) => c.id === charId);
    if (charDef?.maxCount && next > charDef.maxCount) {
      showError(`Bu karakterden maksimum ${charDef.maxCount} eklenebilir.`);
      return;
    }

    const updated = [...room.selectedCharacters];
    if (delta > 0) {
      updated.push(charId);
    } else {
      const idx = updated.lastIndexOf(charId);
      if (idx !== -1) updated.splice(idx, 1);
    }
    socket!.emit('update-settings', { selectedCharacters: updated });
  };

  const adjustDuration = (
    field: 'dayDurationSeconds' | 'nightDurationSeconds',
    delta: number,
    min: number,
    max: number,
  ) => {
    if (!isHost) return;

    const current = room[field];
    const next = clamp(current + delta, min, max);
    if (next === current) return;
    socket!.emit('update-settings', { [field]: next });
  };

  const adjustVampires = (delta: number) => {
    if (!isHost) return;

    const next = vampireCount + delta;
    if (next < 1 || next > maxVampires) return;

    const updated = [...room.selectedCharacters];
    if (delta > 0) {
      updated.push('vampire');
    } else {
      const index = updated.lastIndexOf('vampire');
      if (index !== -1) updated.splice(index, 1);
    }

    socket!.emit('update-settings', { selectedCharacters: updated });
  };

  const handleStart = () => {
    if (!isHost) {
      showError('Yalnızca oda sahibi ayini başlatabilir.');
      return;
    }
    if (mismatch) {
      showError(`Karakter sayısı (${totalSelected}) oyuncu sayısıyla (${playerCount}) eşleşmiyor.`);
      return;
    }
    if (playerCount < 4) {
      showError('Oyun başlatmak için en az 4 oyuncu gerekli.');
      return;
    }
    socket!.emit('start-game');
  };

  const handleSendChat = () => {
    const message = chatInput.trim();
    if (!message) return;
    if (!connected) {
      showError('Sunucuya bağlanılamadı.');
      return;
    }
    socket?.emit('chat-message', { message });
    setChatInput('');
  };

  return (
    <GameShell
      identityName={myPlayer?.nickname || 'Oyuncu'}
      identitySubtitle={isHost ? 'Oda Sahibi' : connected ? 'Ayin Bekleniyor' : 'Bağlantı Yenileniyor'}
      activeNav="village"
    >
      <ErrorToast message={error} />

      <div className="ritual-grid">
        <section className="ritual-column ritual-column-left">
          <article className="ritual-panel ritual-room-card">
            <p className="ritual-label">Lobi Kodu</p>
            <div className="ritual-room-code-row">
              <h2 id="room-code-display" className="ritual-room-code" onClick={handleCopyCode} title="Kopyala">
                {room.code}
              </h2>
              <button type="button" className="ritual-copy-button" onClick={handleCopyCode}>
                <span className="material-symbols-outlined icon-lined" aria-hidden="true">
                  {copied ? 'done' : 'content_copy'}
                </span>
              </button>
            </div>
            <div className="ritual-room-meta">
              <span>Durum</span>
              <span className={`ritual-chip ${canStart ? 'is-ready' : ''}`}>{lobbyStatusDetail}</span>
            </div>
          </article>

          <article className="ritual-panel ritual-settings-panel">
            <div className="ritual-panel-header compact">
              <h3 className="ritual-panel-title">Oyun Kuralları</h3>
              <span className={`ritual-chip subtle ${mismatch ? 'is-warning' : ''}`}>
                {totalSelected}/{playerCount} seçili
              </span>
            </div>

            <LobbyControl
              label="Vampir Sayısı"
              value={String(vampireCount)}
              percent={(vampireCount / maxVampires) * 100}
              disabled={!isHost}
              onDecrease={() => adjustVampires(-1)}
              onIncrease={() => adjustVampires(1)}
            />

            <LobbyControl
              label="Gündüz Tartışması"
              value={formatDuration(room.dayDurationSeconds)}
              percent={((room.dayDurationSeconds - MIN_DAY_SECONDS) / (MAX_DAY_SECONDS - MIN_DAY_SECONDS)) * 100}
              disabled={!isHost}
              onDecrease={() => adjustDuration('dayDurationSeconds', -DAY_STEP_SECONDS, MIN_DAY_SECONDS, MAX_DAY_SECONDS)}
              onIncrease={() => adjustDuration('dayDurationSeconds', DAY_STEP_SECONDS, MIN_DAY_SECONDS, MAX_DAY_SECONDS)}
            />

            <LobbyControl
              label="Gece Evresi"
              value={formatDuration(room.nightDurationSeconds)}
              percent={((room.nightDurationSeconds - MIN_NIGHT_SECONDS) / (MAX_NIGHT_SECONDS - MIN_NIGHT_SECONDS)) * 100}
              disabled={!isHost}
              onDecrease={() => adjustDuration('nightDurationSeconds', -NIGHT_STEP_SECONDS, MIN_NIGHT_SECONDS, MAX_NIGHT_SECONDS)}
              onIncrease={() => adjustDuration('nightDurationSeconds', NIGHT_STEP_SECONDS, MIN_NIGHT_SECONDS, MAX_NIGHT_SECONDS)}
            />

            <div className="ritual-divider" />

            <div className="ritual-character-list">
              {characters.map((char) => (
                <CharacterPickerRow
                  key={char.id}
                  char={char}
                  count={charCounts[char.id] || 0}
                  disabled={!isHost}
                  onInc={() => updateChar(char.id, 1)}
                  onDec={() => updateChar(char.id, -1)}
                />
              ))}
            </div>
          </article>

          <button
            id="btn-start-game"
            type="button"
            className="ritual-start-button"
            onClick={handleStart}
            disabled={!isHost || !canStart}
          >
            <span className="material-symbols-outlined icon-lined" aria-hidden="true">
              swords
            </span>
            <span>Ayini Başlat</span>
          </button>

          <p className={`ritual-start-hint ${canStart ? 'is-ready' : ''}`}>
            {!isHost
              ? 'Yalnızca oda sahibi ayini başlatabilir.'
              : mismatch
                ? `Karakter sayısını oyuncu sayısıyla eşitle (${playerCount}).`
                : playerCount < 4
                  ? 'En az 4 oyuncu gerekli.'
                  : 'Her şey hazır. Ayin başlayabilir.'}
          </p>
        </section>

        <section className="ritual-column ritual-column-center">
          <div className="ritual-section-head">
            <h2>Köy Sakinleri</h2>
            <span>Kapasite: {PLAYER_CAPACITY}</span>
          </div>

          <div className="ritual-player-grid">
            {players.map((player) => (
              <article
                key={player.id}
                className={`ritual-player-tile ${player.id === playerId ? 'is-self' : ''}`}
              >
                <div className="ritual-player-avatar" aria-hidden="true">
                  {player.nickname.slice(0, 1).toUpperCase()}
                </div>
                <h3>{player.nickname}</h3>
                <div className="ritual-player-tags">
                  {player.id === playerId && <span className="ritual-chip subtle">Sen</span>}
                  {player.isHost && <span className="ritual-chip is-host">Kurucu</span>}
                </div>
              </article>
            ))}

            {Array.from({ length: fillerCount }, (_, index) => (
              <article
                key={`placeholder-${index}`}
                className={`ritual-player-placeholder ${index === 0 ? 'is-invite' : ''}`}
              >
                <span className="material-symbols-outlined icon-lined" aria-hidden="true">
                  {index === 0 ? 'person_add' : 'hourglass_empty'}
                </span>
                <span>{index === 0 ? 'Davet Et' : 'Boş Yuva'}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="ritual-column ritual-column-right">
          <article className="ritual-panel ritual-feed-panel">
            <div className="ritual-panel-header">
              <h3 className="ritual-panel-title">Köy Meydanı</h3>
              <span className="material-symbols-outlined icon-lined" aria-hidden="true">
                forum
              </span>
            </div>

            <div className="ritual-feed" role="log" aria-live="polite">
              {feed.map((item) => (
                item.type === 'system' ? (
                  <div key={item.id} className="ritual-feed-system">
                    <span>{item.message}</span>
                  </div>
                ) : (
                  <div
                    key={item.id}
                    className={`ritual-feed-message ${item.self ? 'is-self' : ''}`}
                  >
                    <span className="ritual-feed-author">{item.self ? 'Sen' : item.nickname}</span>
                    <div className="ritual-feed-bubble">{item.message}</div>
                  </div>
                )
              ))}
              <div ref={feedEndRef} />
            </div>

            <form
              className="ritual-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendChat();
              }}
            >
              <input
                className="ritual-chat-input"
                placeholder={feedPlaceholder}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                disabled={!connected}
                maxLength={300}
              />
              <button type="submit" className="ritual-chat-send" disabled={!connected || !chatInput.trim()}>
                <span className="material-symbols-outlined icon-lined" aria-hidden="true">
                  send
                </span>
              </button>
            </form>
          </article>
        </section>
      </div>
    </GameShell>
  );
}

function CharacterPickerRow({
  char, count, disabled, onInc, onDec,
}: {
  char: CharacterDef;
  count: number;
  disabled: boolean;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="ritual-role-row">
      <div className="ritual-role-copy">
        <span className="ritual-role-icon">{char.icon}</span>
        <div>
          <p className="ritual-role-name">{char.name}</p>
          <p className="ritual-role-desc">{char.description.slice(0, 56)}...</p>
        </div>
      </div>
      <div className="ritual-role-controls">
        <button type="button" className="ritual-mini-button" onClick={onDec} disabled={disabled || count === 0}>
          <span className="material-symbols-outlined icon-lined" aria-hidden="true">
            remove
          </span>
        </button>
        <span className="ritual-role-count">{count}</span>
        <button type="button" className="ritual-mini-button" onClick={onInc} disabled={disabled}>
          <span className="material-symbols-outlined icon-lined" aria-hidden="true">
            add
          </span>
        </button>
        <span className={`char-team ${TEAM_CLASS[char.team]}`}>{TEAM_LABELS[char.team]}</span>
      </div>
    </div>
  );
}

function LobbyControl({
  label,
  value,
  percent,
  disabled,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  percent: number;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="ritual-control">
      <div className="ritual-control-head">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="ritual-control-row">
        <button type="button" className="ritual-mini-button" onClick={onDecrease} disabled={disabled}>
          <span className="material-symbols-outlined icon-lined" aria-hidden="true">
            remove
          </span>
        </button>
        <div className="ritual-progress-track" aria-hidden="true">
          <div className="ritual-progress-fill" style={{ width: `${clamp(percent, 0, 100)}%` }} />
        </div>
        <button type="button" className="ritual-mini-button" onClick={onIncrease} disabled={disabled}>
          <span className="material-symbols-outlined icon-lined" aria-hidden="true">
            add
          </span>
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60} Dk`;
  }
  return `${seconds} Sn`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
