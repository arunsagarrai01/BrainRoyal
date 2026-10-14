import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Lazily create an authenticated Socket.IO connection.
 * Used for real-time PvP battles and matchmaking.
 */
export function useSocket(enabled = true) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const token = localStorage.getItem('qba_token');
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

    const socket = io(url, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}
