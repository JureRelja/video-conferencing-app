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

  const getStream = async () => {
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
  };

  useEffect(() => {
    getStream();
  }, []);

  // Chat
  // const [message, setMessage] = useState<string>('');
  // const [messages, setMessages] = useState<Message[]>([]);
  // const [chatHidden, setChatHidden] = useState<boolean>(true);

  // const sendMessageHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   e.preventDefault();

  //   const messageForSending: Message = {
  //     id: Date.now(),
  //     message: message,
  //     name: thisParticipant?.name as string,
  //     socketId: thisParticipant?.socketId as string,
  //     roomUUID: params.id as string,
  //   };

  //   webSocketsSignalling.emitMessage(messageForSending);

  //   setMessages((prev) => [...prev, messageForSending]);

  //   setMessage('');
  // };

  // const handleNewMessage = (message: Message) => {
  //   setMessages((prev) => {
  //     if (prev.find((msg) => msg.id === message.id)) {
  //       return prev;
  //     } else {
  //       return [...prev, message];
  //     }
  //   });
  // };

  return (
    <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
      {/* Chat */}

      {deviceData && (
        <div className="flex flex-wrap gap-4 justify-around w-full">
          {participants &&
            participants.map((participant) => {
              return (
                <Video
                  key={participant.id}
                  isModerator={participant.role === 'MODERATOR'}
                  name={participant.name}
                  total={total}
                  deviceData={deviceData}
                  roomId={id}
                />
              );
            })}
        </div>
      )}

      {/* <div className="flex flex-col gap-2 justify-center items-center w-full">
        <h2 className="text-2xl text-center">Chat</h2>
        <p className="text-gray-500 text-sm">Chat je trenutno u razvoju...</p>
      {/* 
      <div>
      {!chatHidden ? (
          <div className="flex gap-2 justify-center items-center">
            <div className="flex flex-col justify-end items-end ">
              <Button label="Sakrij chat ->" onClick={() => setChatHidden(true)} />
            </div>
            <div className="flex flex-col w-[400px] h-full py-2 border-2 border-gray-200">
              <div className="h-[500px] flex flex-col gap-2 overflow-y-auto px-2">
                {messages.map((message) => {
                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.socketId === thisParticipant?.socketId ? 'justify-end' : 'justify-start'} items-center gap-2`}>
                      <div className="flex flex-col">
                        <p className={`underline ${message.socketId === thisParticipant?.socketId ? 'text-end' : 'text-start'}`}>
                          {message.socketId === thisParticipant?.socketId ? 'Vi' : remoteParticipant?.name}
                        </p>
                        <p className=" border-2 border-gray-200 p-2 rounded-md">{message.message}</p>{' '}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="flex justify-between gap-2 items-center p-2 border-t-2 border-gray-200">
                <input
                  className="border-2 px-3 py-[6px] rounded-md border-gray-400 w-full"
                  type="text"
                  placeholder="Poruka..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button
                  label="Send"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    sendMessageHandler(event);
                  }}
                />
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-end items-end ">
            <Button label="<- Prikaži chat" onClick={() => setChatHidden(false)} />
          </div>
        )}
      </div> */}

      {/* Invite */}
      <div className="flex items-center gap-2 justify-center w-fit">
        <Input value={`https://projektr-fer-frontend.onrender.com/?roomId=${id}`} readOnly className="border-gray-400 border-2 bg-white p-2 " />
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(`https://projektr-fer-frontend.onrender.com/?roomId=${id}`);
          }}>
          Kopiraj link
        </Button>
      </div>
    </div>
  );
}
