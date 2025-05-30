'use client';
import { io } from 'socket.io-client';

const socket = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`, {});

socket.connect();

socket.on('connect', () => {
  console.log('Connected to backend');
});

socket.on('disconnect', () => {
  console.log('Disconnected from backend');
});

export default socket;
