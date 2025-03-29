'use client';
import socket from '@/socket/socket-io';

export default function Home() {
  console.log('Socket:', socket);

  return <div></div>;
}
