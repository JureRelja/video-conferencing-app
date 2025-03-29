'use client';

import socket from '@/socket/socket-io';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Home() {
  console.log('Socket:', socket);

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
    <div className="flex flex-col justify-center items-center gap-5">
      {/* <div className="flex h-full gap-10 justify-between items-center">
        <div className="flex flex-col gap-5 justify-center items-center">
          <div className="flex gap-2">
            {thisParticipantVideo && (
              <div className="h-full w-full">
                <video autoPlay={true} controls={false} ref={thisParticipantVideo} width="950px" height="800px" />
                {thisParticipant && <p className="text-center">{thisParticipant.name}</p>}
              </div>
            )}

            {remoteParticipantVideo && (
              <div className="h-full w-full">
                <video autoPlay={true} controls={false} ref={remoteParticipantVideo} width="950px" height="800px" />
                {remoteParticipant && <p className="text-center">{remoteParticipant.name}</p>}
              </div>
            )}
          </div>
        </div> */}

      {/* Chat */}
      {/* {!chatHidden ? (
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
      {/* <div className="flex items-center gap-2 w-full justify-center">
        <input
          value={`https://projektr-fer-frontend.onrender.com/?roomId=${params.id}`}
          disabled
          className="border-gray-400 border-2 bg-white p-2 "
        />
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(`https://projektr-fer-frontend.onrender.com/?roomId=${params.id}`);
          }}
        >Kopiraj link</Button>
      </div> */}
    </div>
  );
}
