'use server';

import { Room } from '@/types/room';

export async function startCall() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/`, {
    method: 'POST',
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

export async function roomExists(formData: FormData) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/room/${formData.get('roomCode') as string}`, {
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

//not used
export async function joinCall(socketId: string, name: string, roomUUID: string) {
  const participant = {
    socketId: socketId,
    name: name,
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/${roomUUID}`, {
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

  console.log(data);

  return data;
}
