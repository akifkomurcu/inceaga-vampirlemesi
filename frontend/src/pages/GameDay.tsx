import { useState, useEffect, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Countdown from '../components/Countdown';

interface ChatMsg {
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export default function GameDay() {
  const { room, playerId, myCharacterId } = useGame();
  const { socket } = useSocket();
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const phase = room?.phase;
  const isVoting = phase === 'day_vote';
  const me = room?.players[playerId || ''];
  const isAlive = me?.isAlive ?? false;

  useEffect(() => {
    if (!socket) return;

    const onChat = (msg: ChatMsg) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const onVoteCast = (data: { voterId: string; votes: Record<string, string> }) => {
      setVotes(data.votes);
    };

    socket.on('chat-message', onChat);
    socket.on('vote-cast', onVoteCast);
    return () => {
      socket.off('chat-message', onChat);
      socket.off('vote-cast', onVoteCast);
    };
  }, [socket]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket?.emit('chat-message', { message: chatInput.trim() });
    setChatInput('');
  };

  const castVote = (targetId: string) => {
    if (!isAlive || myVote) return;
    socket?.emit('cast-vote', { targetId });
    setMyVote(targetId);
  };

  if (!room) return null;
  const alivePlayers = Object.values(room.players).filter((p) => p.isAlive);
  const voteCountMap: Record<string, number> = {};
  alivePlayers.forEach((p) => (voteCountMap[p.id] = 0));
  Object.values(votes).forEach((tid) => { if (voteCountMap[tid] !== undefined) voteCountMap[tid]++; });


  return (
    <div className="page-top">
      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        {/* Phase Banner */}
        <div className={`phase-banner ${isVoting ? 'vote' : 'day'} mb-16`}>
          <p className="phase-label" style={{ color: isVoting ? '#e74c3c' : '#f1c40f' }}>
            {isVoting ? '🗳️ Oylama Zamanı!' : '☀️ Gündüz — Tur ' + room.round}
          </p>
          {room.phaseDeadline && (
            <Countdown deadline={room.phaseDeadline} urgentAt={30} />
          )}
        </div>

        {/* Rolüm */}
        {myCharacterId && (
          <div className="glass mb-16" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.6rem' }}>
              {/* emoji from character */}
              {['🧑‍🌾','🧛','🕵️','👨‍⚕️','🧙‍♀️','🏹','🃏','🐺'][
                ['villager','vampire','detective','doctor','witch','hunter','jester','familiar'].indexOf(myCharacterId)
              ] || '❓'}
            </span>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rolün</p>
              <p style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.95rem' }}>
                {myCharacterId.charAt(0).toUpperCase() + myCharacterId.slice(1)}
              </p>
            </div>
            {!isAlive && (
              <span className="player-badge badge-host" style={{ marginLeft: 'auto' }}>💀 Elendi</span>
            )}
          </div>
        )}

        {/* Oyuncu listesi + oy sayıları */}
        <div className="glass mb-16" style={{ padding: 16 }}>
          <p className="section-title">{isVoting ? 'Kimi eliminate etmek istiyorsun?' : 'Oyuncular'}</p>
          <div className="target-list">
            {Object.values(room.players).map((p) => {
              const isMe = p.id === playerId;
              const voteCount = voteCountMap[p.id] || 0;
              const isSelected = myVote === p.id;
              const canVote = isVoting && isAlive && !isMe && p.isAlive && !myVote;

              return (
                <div
                  key={p.id}
                  id={`player-${p.id}`}
                  className={`target-item ${!p.isAlive ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => canVote && castVote(p.id)}
                  style={{ cursor: canVote ? 'pointer' : 'default' }}
                >
                  <div className="player-avatar">
                    {p.nickname[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="player-name">{p.nickname} {!p.isAlive && '💀'}</p>
                    {isVoting && voteCount > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--accent-blood-light)' }}>
                        {'🩸'.repeat(Math.min(voteCount, 8))} {voteCount} oy
                      </p>
                    )}
                  </div>
                  {isMe && <span className="player-badge badge-you">Sen</span>}
                  {p.isHost && <span className="player-badge badge-host">👑</span>}
                </div>
              );
            })}
          </div>
          {isVoting && myVote && (
            <p className="text-center text-sm mt-12" style={{ color: 'var(--accent-teal)' }}>
              ✅ Oyun verildi. Diğerleri bekleniyor...
            </p>
          )}
          {isVoting && !isAlive && (
            <p className="text-center text-sm mt-12 text-muted">Sen elendiktin için oy veremezsin.</p>
          )}
        </div>

        {/* Chat */}
        <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <p className="section-title" style={{ marginBottom: 0 }}>
              💬 Tartışma {!isVoting ? '' : '(Kapalı)'}
            </p>
          </div>
          <div className="chat-messages" style={{ height: 200 }}>
            {messages.length === 0 && (
              <p className="text-muted text-sm text-center" style={{ marginTop: 40 }}>
                Henüz mesaj yok...
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="chat-message">
                <p className="chat-message-nick">{m.nickname}</p>
                <p className="chat-message-text">{m.message}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {!isVoting && isAlive && (
            <div className="chat-input-row">
              <input
                id="chat-input"
                className="chat-input"
                placeholder="Mesajını yaz..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                maxLength={300}
              />
              <button className="btn btn-secondary btn-sm" onClick={sendChat}>
                Gönder
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
