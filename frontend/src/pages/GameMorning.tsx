import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

const CHAR_EMOJIS: Record<string, string> = {
  villager: '🧑‍🌾', vampire: '🧛', detective: '🕵️', doctor: '👨‍⚕️',
  witch: '🧙‍♀️', hunter: '🏹', jester: '🃏', familiar: '🐺',
};

const CHAR_NAMES: Record<string, string> = {
  villager: 'Köylü', vampire: 'Vampir', detective: 'Dedektif', doctor: 'Doktor',
  witch: 'Cadı', hunter: 'Avcı', jester: 'Joker', familiar: 'Hizmetkar',
};

export default function GameMorning() {
  const { room } = useGame();
  const { socket } = useSocket();
  const [morningData, setMorningData] = useState<{
    killed: { id: string; nickname: string; characterId: string } | null;
  } | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onMorning = (data: any) => {
      setMorningData(data);
    };
    socket.on('morning', onMorning);
    return () => { socket.off('morning', onMorning); };
  }, [socket]);

  const killed = morningData?.killed;

  return (
    <div className="page">
      <div className="container">
        <div className="logo mb-24">
          <h2 className="logo-title" style={{ fontSize: '1.8rem' }}>🌅 Sabah</h2>
          <p className="logo-subtitle">Gece ne oldu?</p>
        </div>

        {killed ? (
          <div className="result-banner bad mb-24">
            <p style={{ fontSize: '3rem', marginBottom: 12 }}>
              {CHAR_EMOJIS[killed.characterId] || '💀'}
            </p>
            <h2 className="font-title mb-8" style={{ color: '#e74c3c', fontSize: '1.4rem' }}>
              {killed.nickname} öldürüldü!
            </h2>
            <p className="text-muted text-sm">
              Meğer <strong style={{ color: '#e74c3c' }}>{CHAR_NAMES[killed.characterId] || killed.characterId}</strong>ymış...
            </p>
          </div>
        ) : (
          <div className="result-banner safe mb-24">
            <p style={{ fontSize: '3rem', marginBottom: 12 }}>✨</p>
            <h2 className="font-title mb-8" style={{ color: 'var(--accent-teal)', fontSize: '1.4rem' }}>
              Bu gece kimse ölmedi!
            </h2>
            <p className="text-muted text-sm">Köy bir gün daha hayatta kaldı.</p>
          </div>
        )}

        {/* Aktif oyuncular */}
        {room && (
          <div className="glass" style={{ padding: 20 }}>
            <p className="section-title">Hayatta Olanlar</p>
            <div className="player-list">
              {Object.values(room.players).map((p) => (
                <div key={p.id} className={`player-card ${!p.isAlive ? 'dead' : ''}`}>
                  <div className="player-avatar">{p.nickname[0]}</div>
                  <p className="player-name">{p.nickname}</p>
                  {!p.isAlive && <span className="player-badge" style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-muted)' }}>💀 Elendi</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-muted text-xs mt-20">
          Tartışma otomatik başlıyor...
        </p>
      </div>
    </div>
  );
}
