import { io } from 'socket.io-client';

// Connect to the specific IP from environment variable
const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: false // We will connect manually when needed
});
