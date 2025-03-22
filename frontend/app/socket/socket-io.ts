import { io } from 'socket.io-client';

const socket = io(`${import.meta.env.BACKEND_URL}`, {});

socket.on('connect', () => {
  console.log('Connected to backend');
});

socket.on('disconnect', () => {
  console.log('Disconnected from backend');
});

export default socket;
