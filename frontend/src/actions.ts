'use server';

import { Room } from './app/types/room';

export async function startCall(socketId: string, formData: FormData) {
  const participant = {
    socketId: socketId,
    name: formData.get('name'),
  };

  console.log('Participant:', participant);

  const response = await fetch(`${process.env.BACKEND_URL}/rooms/`, {
    method: 'POST',
    body: JSON.stringify(participant),
    headers: {
      'Content-type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Room;

  return data;
}

export async function joinCall(socketId: string, formData: FormData) {
  const participant = {
    socketId: socketId,
    name: formData.get('name'),
  };

  const response = await fetch(`${process.env.BACKEND_URL}/rooms/${formData.get('roomCode') as string}`, {
    method: 'POST',
    body: JSON.stringify(participant),
    headers: {
      'Content-type': 'application/json',
    },
  });

  console.log('Response:', response);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Room;

  return data;
}
