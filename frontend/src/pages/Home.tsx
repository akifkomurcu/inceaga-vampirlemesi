import { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useGame } from '../contexts/GameContext';
import { useError } from '../hooks/useError';
import ErrorToast from '../components/ErrorToast';

export default function Home() {
  const { socket, connected } = useSocket();
  const { setCharacters } = useGame();
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const { error, showError } = useError();

  const handleCreate = () => {
    if (!nickname.trim()) { showError('Lütfen bir isim gir.'); return; }
    if (!connected) { showError('Sunucuya bağlanılamadı. Lütfen sayfayı yenile.'); return; }
    socket!.emit('create-room', { nickname: nickname.trim() });

    socket!.once('characters-list', (data: any) => {
      setCharacters(data);
    });
  };

  const handleJoin = () => {
    if (!nickname.trim()) { showError('Lütfen bir isim gir.'); return; }
    if (code.trim().length !== 6) { showError('Oda kodu 6 karakter olmalı.'); return; }
    if (!connected) { showError('Sunucuya bağlanılamadı.'); return; }
    socket!.emit('join-room', { nickname: nickname.trim(), code: code.trim().toUpperCase() });
  };

  const isJoinMode = mode === 'join';

  return (
    <div className="landing-page">
      <ErrorToast message={error} />
      <div className="landing-shell">
        <section className="landing-hero">
          <p className="landing-kicker">Moonlıght</p>
          <div className="landing-brand">
            <div className="landing-brand-mark" aria-hidden="true">
              <span className="material-symbols-outlined icon-lined">bedtime</span>
            </div>
            <div>
              <h1 className="landing-title">Vampir Köylü</h1>
            </div>
          </div>

          <p className="landing-copy">
            Gece çöken köyde ittifak kur, şüpheyi yay ve vampirleri ortaya çıkar.
            Her tur yeni bir yalan, her oylama yeni bir ihanet demek.
          </p>

          <div className="landing-highlights">
            <div className="landing-highlight-card">
              <span className="landing-highlight-label">Ayin Düzeni</span>
              <strong>Canlı lobi, roller, gece ve gündüz evreleri</strong>
            </div>
            <div className="landing-highlight-card">
              <span className="landing-highlight-label">Oyun Hissi</span>
              <strong>Karanlık, keskin ve gotik bir masaüstü atmosferi</strong>
            </div>
          </div>

          <div className="landing-feature-row">
            <span className="ritual-chip subtle">Gerçek zamanlı</span>
            <span className="ritual-chip subtle">4+ oyuncu</span>
            <span className="ritual-chip subtle">Sesli tartışma uyumlu</span>
          </div>
        </section>

        <section className="landing-panel ritual-panel">
          <div className="landing-panel-head">
            <div>
              <p className="landing-panel-kicker">Giriş Kapısı</p>
              <h2>{isJoinMode ? 'Odaya Katıl' : 'Yeni Oda Kur'}</h2>
            </div>
            <p className="landing-connection-state">
              <span className={`conn-dot ${connected ? 'on' : 'off'}`} />
              {connected ? 'Bağlı' : 'Bağlanıyor'}
            </p>
          </div>

          <div className="landing-mode-switch" role="tablist" aria-label="Giriş tipi">
            <button
              type="button"
              className={`landing-mode-button ${!isJoinMode ? 'is-active' : ''}`}
              onClick={() => setMode('menu')}
            >
              <span className="material-symbols-outlined icon-lined" aria-hidden="true">castle</span>
              Oda Oluştur
            </button>
            <button
              id="btn-join-mode"
              type="button"
              className={`landing-mode-button ${isJoinMode ? 'is-active' : ''}`}
              onClick={() => setMode('join')}
            >
              <span className="material-symbols-outlined icon-lined" aria-hidden="true">meeting_room</span>
              Odaya Katıl
            </button>
          </div>

          <div className="landing-form">
            <label className="landing-field-label" htmlFor="input-nickname">Oyuncu Adı</label>
            <input
              id="input-nickname"
              className="landing-input"
              placeholder="İsminizi girin..."
              value={nickname}
              maxLength={20}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (isJoinMode ? handleJoin() : handleCreate())}
            />

            {isJoinMode && (
              <>
                <label className="landing-field-label" htmlFor="input-room-code">Oda Kodu</label>
                <input
                  id="input-room-code"
                  className="landing-input landing-input-code"
                  placeholder="ABCD12"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </>
            )}
          </div>

          <div className="landing-action-stack">
            {isJoinMode ? (
              <div className="landing-join-actions">
                <button id="btn-back" type="button" className="landing-secondary-action" onClick={() => setMode('menu')}>
                  Geri
                </button>
                <button id="btn-join" type="button" className="landing-primary-action" onClick={handleJoin}>
                  Katıl ve Bekle
                </button>
              </div>
            ) : (
              <button id="btn-create" type="button" className="landing-primary-action" onClick={handleCreate}>
                Ayini Başlatacak Odayı Kur
              </button>
            )}
          </div>

          <p className="landing-footer-note">
            Arkadaşlarınla aynı odaya gir, rolleri dağıt ve gece çökerken kimin yalan söylediğini bul.
          </p>
        </section>
      </div>
    </div>
  );
}
