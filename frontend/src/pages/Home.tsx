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

  return (
    <div className="page">
      <ErrorToast message={error} />
      <div className="container">
        {/* Logo */}
        <div className="logo">
          <span className="logo-icon">🧛</span>
          <h1 className="logo-title">Vampir Köylü</h1>
          <p className="logo-subtitle">Sosyal Çıkarım Oyunu</p>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: '28px 24px' }}>
          {/* Bağlantı durumu */}
          <p className="text-xs text-muted mb-20" style={{ textAlign: 'right' }}>
            <span className={`conn-dot ${connected ? 'on' : 'off'}`} />
            {connected ? 'Bağlı' : 'Bağlanıyor...'}
          </p>

          {/* Nickname */}
          <p className="section-title">Oyuncu Adı</p>
          <input
            id="input-nickname"
            className="input mb-20"
            placeholder="İsminizi girin..."
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'menu' ? handleCreate() : handleJoin())}
          />

          {mode === 'menu' ? (
            <div className="flex flex-col gap-12">
              <button id="btn-create" className="btn btn-primary btn-lg btn-full" onClick={handleCreate}>
                🏰 Oda Oluştur
              </button>
              <button id="btn-join-mode" className="btn btn-secondary btn-lg btn-full" onClick={() => setMode('join')}>
                🚪 Odaya Katıl
              </button>
            </div>
          ) : (
            <>
              <p className="section-title">Oda Kodu</p>
              <input
                id="input-room-code"
                className="input input-uppercase mb-16"
                placeholder="ABCD12"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
              <div className="flex gap-8">
                <button id="btn-back" className="btn btn-secondary" style={{ minWidth: 80 }} onClick={() => setMode('menu')}>
                  ← Geri
                </button>
                <button id="btn-join" className="btn btn-primary btn-full" onClick={handleJoin}>
                  🚪 Katıl
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-muted text-xs mt-20">
          Arkadaşlarınla aynı odaya katıl, vampirleri bul!
        </p>
      </div>
    </div>
  );
}
