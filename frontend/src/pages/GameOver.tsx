import { useGame } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';

const CHAR_EMOJIS: Record<string, string> = {
  villager: '🧑‍🌾', vampire: '🧛', detective: '🕵️', doctor: '👨‍⚕️',
  witch: '🧙‍♀️', hunter: '🏹', jester: '🃏', familiar: '🐺',
};

const CHAR_NAMES: Record<string, string> = {
  villager: 'Köylü', vampire: 'Vampir', detective: 'Dedektif', doctor: 'Doktor',
  witch: 'Cadı', hunter: 'Avcı', jester: 'Joker', familiar: 'Hizmetkar',
};

const TEAM_COLORS: Record<string, string> = {
  good: '#1abc9c', evil: '#e74c3c', neutral: '#f1c40f',
};

const TEAM_ICONS: Record<string, string> = {
  good: '☀️', evil: '🧛', neutral: '🃏',
};

const TEAM_NAMES: Record<string, string> = {
  good: 'Köylüler Kazandı!', evil: 'Vampirler Kazandı!', neutral: 'Joker Kazandı!',
};

export default function GameOver() {
  const { room, playerId, myCharacterId, characters, setRoom, setMyCharacterId, setAllies } = useGame();
  const navigate = useNavigate();

  if (!room) return null;

  const winner = room.winner || 'good';
  const color = TEAM_COLORS[winner];
  const winClass = `gameover-${winner}`;

  const handlePlayAgain = () => {
    // Reset state and go home
    setRoom(null);
    setMyCharacterId(null);
    setAllies([]);
    navigate('/');
  };

  const myChar = myCharacterId ? characters.find((c) => c.id === myCharacterId) : null;
  const won = myChar?.team === winner || (winner === 'neutral' && room.winnerPlayerId === playerId);

  return (
    <div className="page-top">
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
        {/* Winner announcement */}
        <div className="glass-elevated" style={{ padding: '36px 24px', textAlign: 'center', marginBottom: 24 }}>
          <div className="gameover-icon">{TEAM_ICONS[winner]}</div>
          <h1 className={`gameover-title ${winClass}`}>{TEAM_NAMES[winner]}</h1>

          {won ? (
            <div style={{
              marginTop: 8,
              padding: '10px 20px',
              background: `rgba(${winner === 'good' ? '26,188,156' : winner === 'evil' ? '192,57,43' : '212,160,23'},0.15)`,
              borderRadius: 12,
              display: 'inline-block',
            }}>
              <p style={{ color, fontFamily: 'Cinzel,serif', fontWeight: 700 }}>
                🏆 Kazandın!
              </p>
            </div>
          ) : (
            <div style={{
              marginTop: 8,
              padding: '10px 20px',
              background: 'rgba(100,80,120,0.2)',
              borderRadius: 12,
              display: 'inline-block',
            }}>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Cinzel,serif' }}>
                Kaybettin...
              </p>
            </div>
          )}
        </div>

        {/* Tüm roller açıklanıyor */}
        <div className="glass" style={{ padding: 20, marginBottom: 24 }}>
          <p className="section-title">Herkesin Rolü</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.values(room.players).map((p) => {
              const charDef = characters.find((c) => c.id === p.characterId);
              const teamColor = charDef ? TEAM_COLORS[charDef.team] : 'var(--text-muted)';
              const isMe = p.id === playerId;

              return (
                <div key={p.id} className="player-card" style={{
                  borderColor: isMe ? 'rgba(142,68,173,0.5)' : undefined,
                  background: isMe ? 'rgba(45,20,70,0.6)' : undefined,
                }}>
                  <div className="player-avatar" style={{ background: teamColor }}>
                    {p.nickname[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="player-name">{p.nickname} {!p.isAlive ? '💀' : ''}</p>
                    <p style={{ fontSize: '0.78rem', color: teamColor }}>
                      {CHAR_EMOJIS[p.characterId || ''] || '❓'} {CHAR_NAMES[p.characterId || ''] || p.characterId || '?'}
                    </p>
                  </div>
                  {isMe && <span className="player-badge badge-you">Sen</span>}
                  {p.id === room.winnerPlayerId && (
                    <span className="player-badge" style={{ background: 'rgba(212,160,23,0.2)', color: '#f1c40f', border: '1px solid rgba(212,160,23,0.3)' }}>
                      🏆
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tekrar oyna */}
        <button id="btn-play-again" className="btn btn-primary btn-full btn-lg" onClick={handlePlayAgain}>
          🔄 Ana Menüye Dön
        </button>
      </div>
    </div>
  );
}
