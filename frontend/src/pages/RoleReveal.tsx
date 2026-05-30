import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';

const TEAM_LABELS: Record<string, string> = { good: 'İyi Taraf', evil: 'Kötü Taraf', neutral: 'Nötr' };
const TEAM_CLASS: Record<string, string> = { good: 'team-good', evil: 'team-evil', neutral: 'team-neutral' };
const TEAM_COLOR: Record<string, string> = {
  good: '#1abc9c',
  evil: '#e74c3c',
  neutral: '#f1c40f',
};

export default function RoleReveal() {
  const { myCharacterId, characters, allies } = useGame();
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState('Kartına dokun!');

  const charDef = characters.find((c) => c.id === myCharacterId);

  useEffect(() => {
    // Otomatik fliple 2 saniye sonra
    const t = setTimeout(() => {
      setFlipped(true);
      setHint('İşte rolün! 👆');
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  if (!charDef) {
    return (
      <div className="page">
        <p style={{ color: 'var(--text-muted)' }}>Rol bekleniyor...</p>
      </div>
    );
  }

  const teamColor = TEAM_COLOR[charDef.team] || '#fff';

  return (
    <div className="page">
      <div className="container">
        <div className="logo mb-24">
          <h2 className="logo-title" style={{ fontSize: '1.6rem' }}>Rolün Açıklanıyor</h2>
          <p className="logo-subtitle">Bu bilgi sadece sana özel!</p>
        </div>

        {/* Flip Card */}
        <div
          id="role-flip-card"
          className={`role-card ${flipped ? 'flipped' : ''}`}
          onClick={() => { setFlipped(true); setHint('İşte rolün!'); }}
        >
          <div className="role-card-inner">
            {/* Ön yüz */}
            <div className="role-card-face role-card-front">
              <span className="card-pattern">🩸</span>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 16 }}>
                Dokunarak aç
              </p>
            </div>

            {/* Arka yüz */}
            <div className="role-card-face role-card-back">
              <span className="role-icon">{charDef.icon}</span>
              <p className="role-name" style={{ color: teamColor }}>{charDef.name}</p>
              <p className="role-desc">{charDef.description}</p>
              {charDef.hasNightAction && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 14px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 10,
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}>
                  🌙 {charDef.nightActionDescription}
                </div>
              )}
              <span className={`char-team role-team ${TEAM_CLASS[charDef.team]}`} style={{ marginTop: 16 }}>
                {TEAM_LABELS[charDef.team]}
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-muted text-sm mt-16">{hint}</p>

        {/* Müttefikler (vampir/hizmetkar için) */}
        {flipped && allies.length > 1 && (
          <div className="glass mt-20" style={{ padding: 16 }}>
            <p className="section-title" style={{ color: '#e74c3c' }}>🩸 Takım Arkadaşların</p>
            <div className="ally-list">
              {allies
                .filter((a) => a.id !== /* my id will be excluded */ '')
                .map((a) => (
                  <span key={a.id} className="ally-chip">
                    {a.nickname} {a.characterId === 'familiar' ? '(Hizmetkar)' : ''}
                  </span>
                ))}
            </div>
          </div>
        )}

        <p className="text-center text-muted text-xs mt-20" style={{ maxWidth: 280, margin: '20px auto 0' }}>
          Gündüz başlıyor... Rolünü kimseyle paylaşma!
        </p>
      </div>
    </div>
  );
}
