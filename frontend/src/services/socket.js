import { io } from 'socket.io-client';

let socket;

export const getSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      autoConnect: false,
      auth: { token: localStorage.getItem('devtrack_access_token') },
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  s.auth.token = localStorage.getItem('devtrack_access_token');
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};
