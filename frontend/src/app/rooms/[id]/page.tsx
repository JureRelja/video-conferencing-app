'use client';

import { Button } from '@/components/ui/button';
import { joinCall } from '@/actions';
import Video from '@/components/video/video';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppData, RtpCapabilities, TransportOptions } from 'mediasoup-client/types';
import socket from '@/socket/socket-io';
import { useSearchParams } from 'next/navigation';

type Participant = {
  id: number;
  socketId: string;
  name: string;
  role: 'USER' | 'MODERATOR';
  roomId: number;
};

export default function Home() {
  const [initialized, setInitialized] = useState(false);
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [total, setTotal] = useState<number>(20);
  const [participants, setParticipants] = useState<Participant[]>();
  const [deviceData, setDeviceData] = useState<{
    rtpCapabilities: RtpCapabilities;
    producerTransport: TransportOptions<AppData>;
    consumerTransport: TransportOptions<AppData>;
  } | null>(null);

  const getRtp = async () => {
    await joinCall(socket.id as string, searchParams.get('name') as string, id);

    const [mediaSoupRes, roomParticipantsRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/router/${id}`, {
        body: JSON.stringify({
          socketId: socket.id,
        }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [mediaSoupData, roomParticipantsData] = await Promise.all([mediaSoupRes.json(), roomParticipantsRes.json()]);

    console.log(mediaSoupData);
    console.log(roomParticipantsData);

    setDeviceData(mediaSoupData);
    setParticipants(roomParticipantsData);
    setTotal(roomParticipantsData?.length ?? 0);
  };

  const fetchParticipants = async () => {
    const roomParticipantsRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/rooms/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const roomParticipantsData = await roomParticipantsRes.json();

    setParticipants(roomParticipantsData);
    setTotal(roomParticipantsData?.length ?? 0);
  };

  useEffect(() => {
    if (!id || !searchParams.get('name') || !socket.id) {
      return;
    }
    //join room
    if (!initialized) {
      console.log('joined room');
      getRtp();

      socket.emit('join-room', id);
      setInitialized(true);
    }

    socket.on('new-participant-joinned', () => {
      fetchParticipants();
    });

    return () => {
      socket.off('new-participant-joinned');
    };
  }, []);

  return (
    <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
      {deviceData && (
        <div className="flex flex-wrap gap-4 justify-around w-full">
          {participants &&
            participants.map((participant) => {
              return (
                <Video
                  key={participant.id}
                  isModerator={participant.role === 'MODERATOR'}
                  isThisUser={socket.id === participant.socketId}
                  socketId={participant.socketId}
                  name={participant.name}
                  total={total}
                  deviceData={deviceData}
                  roomId={id}
                />
              );
            })}
        </div>
      )}

      {/* Invite */}
      <div className="flex items-center gap-2 justify-center w-fit">
        <Input value={`${process.env.FRONTEND_URL}/?roomId=${id}`} readOnly className="border-gray-400 border-2 bg-white p-2 " />
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(`${process.env.FRONTEND_URL}/?roomId=${id}`);
          }}>
          Kopiraj link
        </Button>
      </div>
    </div>
  );
}
