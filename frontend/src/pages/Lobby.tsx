import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import type { CharacterDef } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useError } from '../hooks/useError';
import ErrorToast from '../components/ErrorToast';

const TEAM_LABELS: Record<string, string> = { good: 'İyi', evil: 'Kötü', neutral: 'Nötr' };
const TEAM_CLASS: Record<string, string> = { good: 'team-good', evil: 'team-evil', neutral: 'team-neutral' };

export default function Lobby() {
  const { room, playerId, characters } = useGame();
  const { socket } = useSocket();
  const { error, showError } = useError();
  const [copied, setCopied] = useState(false);

  if (!room) return null;
  const isHost = room.hostId === playerId;
  const players = Object.values(room.players);

  // Karakter havuzu: her karakter id'si kaç kez seçildi
  const charCounts: Record<string, number> = {};
  room.selectedCharacters.forEach((id) => {
    charCounts[id] = (charCounts[id] || 0) + 1;
  });

  const totalSelected = room.selectedCharacters.length;
  const playerCount = players.length;
  const mismatch = totalSelected !== playerCount;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateChar = (charId: string, delta: number) => {
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

  const handleStart = () => {
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

  return (
    <div className="page-top">
      <ErrorToast message={error} />
      <div className="container-wide" style={{ paddingTop: 32, width: '100%', maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div className="logo mb-20" style={{ marginBottom: 20 }}>
          <h1 className="logo-title" style={{ fontSize: '1.8rem' }}>🏰 Bekleme Odası</h1>
        </div>

        {/* Oda Kodu */}
        <div id="room-code-display" className="room-code" onClick={handleCopyCode} title="Kopyala">
          <span className="room-code-text">{room.code}</span>
          <span style={{ fontSize: '1.2rem' }}>{copied ? '✅' : '📋'}</span>
        </div>
        <p className="room-code-hint text-muted text-xs">Arkadaşlarına kodu göster — tıkla kopyala</p>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {/* Oyuncular */}
          <div className="glass" style={{ padding: 20 }}>
            <p className="section-title">Oyuncular ({playerCount})</p>
            <div className="player-list">
              {players.map((p) => (
                <div key={p.id} className="player-card">
                  <div className="player-avatar">
                    {p.nickname[0].toUpperCase()}
                  </div>
                  <span className="player-name">{p.nickname}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.isHost && <span className="player-badge badge-host">Oda Sahibi</span>}
                    {p.id === playerId && <span className="player-badge badge-you">Sen</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Karakter Ayarları (sadece host) */}
          {isHost ? (
            <div className="glass" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-12">
                <p className="section-title" style={{ marginBottom: 0 }}>Karakterler</p>
                <span className={`player-badge ${mismatch ? 'badge-host' : 'badge-good'}`} style={{ fontSize: '0.72rem' }}>
                  {totalSelected}/{playerCount} seçili
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {characters.map((char: CharacterDef) => (
                  <CharacterPickerRow
                    key={char.id}
                    char={char}
                    count={charCounts[char.id] || 0}
                    onInc={() => updateChar(char.id, 1)}
                    onDec={() => updateChar(char.id, -1)}
                  />
                ))}
              </div>

              <div className="divider" />

              <button
                id="btn-start-game"
                className="btn btn-gold btn-full btn-lg"
                onClick={handleStart}
                disabled={mismatch || playerCount < 4}
              >
                ⚔️ Oyunu Başlat
              </button>
              {mismatch && (
                <p className="text-xs text-center mt-8" style={{ color: '#e74c3c' }}>
                  Karakter sayısını oyuncu sayısıyla eşitle ({playerCount})
                </p>
              )}
            </div>
          ) : (
            <div className="glass" style={{ padding: 20 }}>
              <p className="section-title">Seçili Karakterler</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {characters.filter((c) => charCounts[c.id] > 0).map((char) => (
                  <div key={char.id} className="char-card" style={{ cursor: 'default' }}>
                    <span className="char-icon">{char.icon}</span>
                    <div className="char-info">
                      <p className="char-name">{char.name}</p>
                      <p className="char-desc">×{charCounts[char.id]}</p>
                    </div>
                    <span className={`char-team ${TEAM_CLASS[char.team]}`}>{TEAM_LABELS[char.team]}</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <p className="text-center text-muted text-sm">Oda sahibi oyunu başlatmasını bekle...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterPickerRow({
  char, count, onInc, onDec,
}: {
  char: CharacterDef; count: number; onInc: () => void; onDec: () => void;
}) {
  return (
    <div className="char-card" style={{ cursor: 'default' }}>
      <span className="char-icon">{char.icon}</span>
      <div className="char-info">
        <p className="char-name">{char.name}</p>
        <p className="char-desc" style={{ fontSize: '0.74rem' }}>{char.description.slice(0, 60)}…</p>
      </div>
      <div className="char-counter">
        <button className="counter-btn" onClick={onDec} disabled={count === 0}>−</button>
        <span className="counter-num">{count}</span>
        <button className="counter-btn" onClick={onInc}>+</button>
      </div>
    </div>
  );
}
