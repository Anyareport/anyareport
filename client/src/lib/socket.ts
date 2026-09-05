import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(role?: string): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      autoConnect: true,
    });
  }
  if (role) {
    socket.emit('join_role', role);
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
