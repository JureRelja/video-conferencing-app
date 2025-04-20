'use client';

import { Button } from '@/components/ui/button';
import Video from '@/components/video/video';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppData, RtpCapabilities, TransportOptions } from 'mediasoup-client/types';
import socket from '@/socket/socket-io';

type Participant = {
  id: number;
  socketId: string;
  name: string;
  role: 'USER' | 'MODERATOR';
  roomId: number;
};

export default function Home() {
  const { id } = useParams<{ id: string }>();
  const [total, setTotal] = useState<number>(20);
  const [participants, setParticipants] = useState<Participant[]>();
  const [deviceData, setDeviceData] = useState<{
    rtpCapabilities: RtpCapabilities;
    producerTransport: TransportOptions<AppData>;
    consumerTransport: TransportOptions<AppData>;
  } | null>(null);

  const getRtp = async () => {
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
    getRtp()
      .then((res) => {
        void socket.emit('join-room', { roomId: id });

        socket.on('new-participant-joinned', () => {
          fetchParticipants();
        });
      })
      .catch((err) => console.log(err));

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
