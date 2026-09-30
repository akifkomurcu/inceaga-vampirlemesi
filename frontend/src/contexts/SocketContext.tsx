import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
const BACKEND_URL = configuredBackendUrl || undefined;

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const nextSocket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: false,
    });
    setSocket(nextSocket);

    nextSocket.on('connect', () => {
      setConnected(true);
    });
    nextSocket.on('disconnect', () => setConnected(false));

    return () => {
      nextSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
