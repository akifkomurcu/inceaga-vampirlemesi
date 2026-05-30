import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { readLobbySession } from '../utils/lobbySession';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
const BACKEND_URL = configuredBackendUrl || undefined;

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      const session = readLobbySession();
      if (session) {
        socket.emit('rejoin-room', session);
      }
    });
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
