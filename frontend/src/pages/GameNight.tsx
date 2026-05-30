import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Countdown from '../components/Countdown';
import { useError } from '../hooks/useError';
import ErrorToast from '../components/ErrorToast';

const CHAR_EMOJIS: Record<string, string> = {
  villager: '🧑‍🌾', vampire: '🧛', detective: '🕵️', doctor: '👨‍⚕️',
  witch: '🧙‍♀️', hunter: '🏹', jester: '🃏', familiar: '🐺',
};

const CHAR_NAMES: Record<string, string> = {
  villager: 'Köylü', vampire: 'Vampir', detective: 'Dedektif', doctor: 'Doktor',
  witch: 'Cadı', hunter: 'Avcı', jester: 'Joker', familiar: 'Hizmetkar',
};

export default function GameNight() {
  const { room, playerId, myCharacterId, detectiveResult } = useGame();
  const { socket } = useSocket();
  const { error, showError } = useError();
  const [submitted, setSubmitted] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [witchMode, setWitchMode] = useState<'kill' | 'save' | null>(null);
  // Hunter shoot after elimination
  const [hunterMode, setHunterMode] = useState(false);
  const [hunterShot, setHunterShot] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onHunter = () => setHunterMode(true);
    socket.on('hunter-must-shoot', onHunter);
    return () => { socket.off('hunter-must-shoot', onHunter); };
  }, [socket]);

  // Reset on phase change
  useEffect(() => {
    setSubmitted(false);
    setSelectedTarget(null);
    setWitchMode(null);
  }, [room?.round]);

  if (!room) return null;

  const me = room.players[playerId || ''];
  const isAlive = me?.isAlive ?? false;
  const charId = myCharacterId;
  const hasNightAction = ['vampire', 'doctor', 'detective', 'witch'].includes(charId || '');

  const alivePlayers = Object.values(room.players).filter((p) => p.isAlive);
  const targets = alivePlayers.filter((p) => p.id !== playerId);

  const submitAction = (type: string, targetId?: string) => {
    socket?.emit('night-action', { type, targetId });
    setSubmitted(true);
  };

  const handleSubmit = () => {
    if (!charId) return;

    if (charId === 'vampire' || charId === 'doctor' || charId === 'detective') {
      if (!selectedTarget) { showError('Bir oyuncu seç.'); return; }
      const typeMap: Record<string, string> = {
        vampire: 'vampire_kill', doctor: 'doctor_save', detective: 'detective_query',
      };
      submitAction(typeMap[charId], selectedTarget);
    } else if (charId === 'witch') {
      if (!witchMode) { showError('Bir iksir seç veya geç.'); return; }
      if (witchMode === 'kill' && !selectedTarget) { showError('Hedef seç.'); return; }
      if (witchMode === 'save' && !selectedTarget) { showError('Hedef seç.'); return; }
      submitAction(witchMode === 'kill' ? 'witch_kill' : 'witch_save', selectedTarget || undefined);
    }
  };

  const handleHunterShoot = () => {
    if (!selectedTarget) { showError('Vuracağın kişiyi seç.'); return; }
    socket?.emit('hunter-shoot', { targetId: selectedTarget });
    setHunterShot(true);
  };

  // Hunter elimine edildi, ateş etmeli
  if (hunterMode && !hunterShot) {
    return (
      <div className="page">
        <ErrorToast message={error} />
        <div className="container">
          <div className="glass-elevated" style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ fontSize: '3rem' }}>🏹</p>
            <h2 className="font-title mb-12" style={{ color: '#e74c3c', fontSize: '1.4rem' }}>
              Son Okunla Birini Vur!
            </h2>
            <p className="text-muted text-sm mb-20">Elimine edildin ama ölmeden önce birine son okunla vurabilirsin.</p>
            <div className="target-list mb-16">
              {targets.map((p) => (
                <div key={p.id} className={`target-item ${selectedTarget === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTarget(p.id)}>
                  <div className="player-avatar">{p.nickname[0]}</div>
                  <p className="player-name">{p.nickname}</p>
                </div>
              ))}
            </div>
            <button className="btn btn-danger btn-full" onClick={handleHunterShoot}>
              🏹 Vur!
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <ErrorToast message={error} />
      <div className="container">
        {/* Phase Banner */}
        <div className="phase-banner night mb-20">
          <p className="phase-label" style={{ color: '#9b59b6' }}>🌙 Gece — Tur {room.round}</p>
          {room.phaseDeadline && <Countdown deadline={room.phaseDeadline} urgentAt={15} />}
        </div>

        {/* Rolün */}
        <div className="glass mb-20" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '2rem' }}>{CHAR_EMOJIS[charId || ''] || '❓'}</span>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rolün</p>
            <p style={{ fontFamily: 'Cinzel,serif', fontWeight: 600 }}>{CHAR_NAMES[charId || ''] || charId}</p>
          </div>
        </div>

        {/* Dedektif sonucu */}
        {detectiveResult && charId === 'detective' && (
          <div className="glass mb-16" style={{
            padding: '14px 18px',
            borderColor: 'rgba(26,188,156,0.4)',
            background: 'rgba(26,188,156,0.08)',
          }}>
            <p className="section-title" style={{ color: 'var(--accent-teal)' }}>🔍 Sorgu Sonucu</p>
            <p style={{ fontSize: '0.9rem' }}>{detectiveResult}</p>
          </div>
        )}

        {/* Aksiyon arayüzü */}
        {!isAlive ? (
          <div className="glass" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>💀</p>
            <p className="text-muted">Elendiktin için gece aksiyonu yapamazsın.</p>
          </div>
        ) : !hasNightAction ? (
          <div className="glass" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>😴</p>
            <p style={{ fontFamily: 'Cinzel,serif', fontSize: '1.1rem', marginBottom: 8 }}>Uyuma Zamanı</p>
            <p className="text-muted text-sm">Gece aksiyonun yok. Şehir uyanana dek bekle...</p>
          </div>
        ) : submitted ? (
          <div className="glass" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</p>
            <p style={{ fontFamily: 'Cinzel,serif', fontSize: '1rem', color: 'var(--accent-teal)' }}>
              Aksiyon gönderildi!
            </p>
            <p className="text-muted text-sm mt-8">Diğerleri bekleniyor...</p>
          </div>
        ) : (
          <div className="glass" style={{ padding: 20 }}>
            {/* Vampir */}
            {charId === 'vampire' && (
              <>
                <p className="section-title" style={{ color: '#e74c3c' }}>🩸 Kurbanını Seç</p>
                <TargetList players={targets} selected={selectedTarget} onSelect={setSelectedTarget} />
              </>
            )}

            {/* Doktor */}
            {charId === 'doctor' && (
              <>
                <p className="section-title" style={{ color: 'var(--accent-teal)' }}>🛡️ Kimi Koruyorsun?</p>
                <TargetList
                  players={alivePlayers}
                  selected={selectedTarget}
                  onSelect={setSelectedTarget}
                />
              </>
            )}

            {/* Dedektif */}
            {charId === 'detective' && (
              <>
                <p className="section-title" style={{ color: '#9b59b6' }}>🔍 Kimi Sorguluyorsun?</p>
                <TargetList players={targets} selected={selectedTarget} onSelect={setSelectedTarget} />
              </>
            )}

            {/* Cadı */}
            {charId === 'witch' && (
              <>
                <p className="section-title" style={{ color: '#e74c3c' }}>🧪 İksir Seç</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    className={`btn ${witchMode === 'kill' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    onClick={() => { setWitchMode('kill'); setSelectedTarget(null); }}
                  >
                    ☠️ Öldürme
                  </button>
                  <button
                    className={`btn ${witchMode === 'save' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => { setWitchMode('save'); setSelectedTarget(null); }}
                  >
                    💚 Koruma
                  </button>
                </div>
                {witchMode && (
                  <TargetList
                    players={witchMode === 'kill' ? targets : alivePlayers}
                    selected={selectedTarget}
                    onSelect={setSelectedTarget}
                  />
                )}
              </>
            )}

            <div className="divider" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-full" onClick={handleSubmit}>
                Aksiyonu Onayla ✓
              </button>
              <button className="btn btn-secondary btn-sm"
                onClick={() => submitAction('pass')}>
                Geç
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetList({ players, selected, onSelect }: {
  players: any[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="target-list mb-12">
      {players.map((p) => (
        <div
          key={p.id}
          className={`target-item ${selected === p.id ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          <div className="player-avatar">{p.nickname[0].toUpperCase()}</div>
          <p className="player-name">{p.nickname}</p>
          {selected === p.id && <span style={{ color: 'var(--accent-blood-light)' }}>✓</span>}
        </div>
      ))}
    </div>
  );
}
