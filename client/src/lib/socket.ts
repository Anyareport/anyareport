import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let joinedRole: string | undefined;

export function getSocket(role?: string): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      autoConnect: true,
    });
    socket.on('connect', () => {
      if (joinedRole) socket?.emit('join_role', joinedRole);
    });
  }
  if (role) {
    joinedRole = role;
    if (socket.connected) socket.emit('join_role', role);
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  joinedRole = undefined;
}
