import { io } from 'socket.io-client';

// Connect to the specific IP from environment variable
const URL = import.meta.env.VITE_SERVER_URL;

export const socket = io(URL, {
  autoConnect: false // We will connect manually when needed
});

socket.on('connect', () => {
  console.log('Socket Connected');
});

socket.on('disconnect', () => {
  console.log('Socket Disconnected');
});
