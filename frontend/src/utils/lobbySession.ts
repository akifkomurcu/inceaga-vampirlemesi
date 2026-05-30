const LOBBY_SESSION_KEY = 'vampir-lobby-session';

export interface LobbySession {
  code: string;
  nickname: string;
}

export function readLobbySession(): LobbySession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(LOBBY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LobbySession>;
    if (!parsed.code || !parsed.nickname) return null;
    return {
      code: parsed.code.toUpperCase(),
      nickname: parsed.nickname,
    };
  } catch {
    return null;
  }
}

export function saveLobbySession(session: LobbySession) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    LOBBY_SESSION_KEY,
    JSON.stringify({
      code: session.code.toUpperCase(),
      nickname: session.nickname,
    }),
  );
}

export function clearLobbySession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(LOBBY_SESSION_KEY);
}