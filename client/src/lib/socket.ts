import { io, Socket } from 'socket.io-client';
import { auth as firebaseAuth } from './firebase';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      autoConnect: true,
      auth: (callback) => {
        const user = firebaseAuth.currentUser;
        if (!user) {
          callback({ token: '' });
          return;
        }

        void user
          .getIdToken()
          .then((token) => callback({ token }))
          .catch((error: unknown) => {
            console.error('[Socket] Failed to obtain Firebase ID token:', error);
            callback({ token: '' });
          });
      },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
